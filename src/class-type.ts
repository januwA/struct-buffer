import {
  AnyObject,
  Bit_t,
  DecodeBuffer_t,
  InjectNext,
  TypeSize_t,
} from "./interfaces";
import { sizeof } from "./struct-buffer";
import {
  arrayProxyNext,
  createDataView,
  makeDataView,
  realloc,
  unflattenDeep,
} from "./utils";

export const FLOAT_TYPE = "float";
export const DOUBLE_TYPE = "double";

const hData: any = {
  1: {
    1: "getUint8",
    0: "getInt8",
  },
  2: {
    1: "getUint16",
    0: "getInt16",
  },
  4: {
    1: "getUint32",
    0: "getInt32",
  },
  8: {
    1: "getBigUint64",
    0: "getBigInt64",
  },
  f: "getFloat32",
  d: "getFloat64",
};

function typeHandle<D, E>(type: StructType<D, E>): [get: string, set: string] {
  let h: string | undefined = undefined;

  const isFloat =
    type.isName(FLOAT_TYPE.toLowerCase()) ||
    type.isName(FLOAT_TYPE.toUpperCase());

  const isDouble =
    type.isName(DOUBLE_TYPE.toLowerCase()) ||
    type.isName(DOUBLE_TYPE.toUpperCase());

  if (isFloat) h = hData["f"];
  if (isDouble) h = hData["d"];

  if (!h) h = hData[type.size][+type.unsigned];
  if (!h) throw new Error(`StructBuffer: Unrecognized ${type} type.`);

  return [h, h.replace(/^g/, "s")];
}

class StructTypeNext {
  constructor() {
    return arrayProxyNext(this, StructTypeNext);
  }
}

// D decode return type
// E encode obj type
export class StructType<D, E> extends Array<StructType<D[], E[]>> {
  names: string[];
  deeps: number[] = [];

  /**
   * ```
   * float[2] => true
   * float    => false
   * ```
   */
  get isList(): boolean {
    return !!this.deeps.length;
  }

  // 最少会返回1
  get count(): number {
    return this.deeps.reduce((acc, it) => (acc *= it), 1);
  }

  is<D, E>(type: StructType<D, E>): boolean {
    return type.names.some((name) => this.names.includes(name));
  }

  isName(typeName: string) {
    return this.names.includes(typeName);
  }

  get: string;
  set: string;

  constructor(
    typeName: string | string[],
    public size: TypeSize_t,
    public readonly unsigned: boolean
  ) {
    super();
    this.names = Array.isArray(typeName) ? typeName : [typeName];

    if (this.size) {
      const [get, set] = typeHandle(this);
      this.set = set;
      this.get = get;
    } else {
      this.set = this.get = "";
    }
    return arrayProxyNext(this, StructTypeNext);
  }

  /**
   *
   * ```ts
   * DWORD.decode( new Uint8Array([0,0,0,1]) ) => 1
   *
   * DWORD[2].decode( new Uint8Array([0,0,0,1, 0,0,0,2]) ) => [1, 2]
   * ```
   *
   * @param view
   * @param littleEndian
   * @param offset
   */
  decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ): D {
    view = makeDataView(view);

    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      result.push((view as any)[this.get](offset, littleEndian));
      offset += this.size;
    }
    return this.isList ? unflattenDeep(result, this.deeps, false) : result[0];
  }

  /**
   *
   * ```ts
   * DWORD.encode(4)         => <00 00 00 02>
   *
   * DWORD[2].encode([1,2])  => <00 00 00 01 00 00 00 02>
   *
   * // padding zero
   * DWORD[2].encode([1])    => <00 00 00 01 00 00 00 00>
   * ```
   *
   * @param obj
   * @param littleEndian
   * @param offset
   * @param view
   */
  encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = createDataView(this.count * this.size, view);

    if (this.isList && Array.isArray(obj)) (obj as any) = obj.flat();

    for (let i = 0; i < this.count; i++) {
      const it = (this.isList ? (obj as any)[i] : obj) ?? 0;
      try {
        (v as any)[this.set](offset, it, littleEndian);
      } catch (error) {
        (v as any)[this.set](offset, BigInt(it), littleEndian);
      }
      offset += this.size;
    }

    return v;
  }
}

type BitsType_t = { [k: string]: number };
export class BitsType<
  D = {
    [key in keyof BitsType_t]: Bit_t;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: TypeSize_t, public readonly bits: BitsType_t) {
    super("<bits>", size, true);
  }

  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset
    ) as any;
    if (this.isList && Array.isArray(data)) {
      return data.map((it) => {
        const result: { [k: string]: Bit_t } = {};
        Object.entries(this.bits).forEach(([k, i]) => {
          result[k] = ((it & (1 << i)) >> i) as Bit_t;
        });
        return result;
      }) as any;
    } else {
      const result: { [k: string]: Bit_t } = {};
      Object.entries(this.bits).forEach(([k, i]) => {
        result[k] = (((data as number) & (1 << i)) >> i) as Bit_t;
      });
      return result as any;
    }
  }

  override encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = createDataView(this.count * this.size, view);

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.count; i++) {
        let flags = 0;
        Object.entries<number>(obj[i]).forEach(([k, v]) => {
          const i: number = this.bits![k];
          if (i !== undefined) flags |= v << i;
        });
        (v as any)[this.set](offset, flags, littleEndian);
        offset += this.size;
      }

      return v;
    } else {
      let flags = 0;
      Object.entries<number>(obj as any).forEach(([k, v]) => {
        const i: number = this.bits![k];
        if (i !== undefined) flags |= v << i;
      });
      (v as any)[this.set](offset, flags, littleEndian);
      return v;
    }
  }
}

/**
 * ## bit-fields
 *
 * ```c++
 *struct T {
 *  uint8_t a : 1;
 *  uint8_t b : 2;
 *  uint8_t c : 3;
 *};
 *int main()
 *{
 *  T t{ 1,2,3 };
 *  printf("%p\n", &t); // *&t === `0001 1101` === `0x1D`
 *  printf("size: %d\n", sizeof(t)); // 1
 *  printf("%d\n", t.a); // 1
 *  printf("%d\n", t.b); // 2
 *  printf("%d\n", t.c); // 3
 *  return 0;
 *}
 * ```
 *
 * ## example
 * ```ts
 * const bf = bitFields(uint8_t, {
 *  a: 1,
 *  b: 2,
 *  c: 3,
 * });
 *
 * bf.dncode( new Uint8Array([0x1D]) ); // { a:1, b:2, c:3 }
 *
 * bf.encode({ a:1, b:2, c:3 });// <1D>
 * ```
 */
export class BitFieldsType<
  D = {
    [key in keyof BitsType_t]: number;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: TypeSize_t, public readonly bitFields: BitsType_t) {
    super("<bit-fields>", size, true);
  }

  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset
    ) as any;

    let i = 0;
    const _getValue = (data: number, len: number) => {
      let val = 0;
      let count = 0;
      while (len--) {
        const b = (data >> i) & 1;
        val |= b << count;
        i++;
        count++;
      }
      return val;
    };
    const result: BitsType_t = {};
    if (this.isList && Array.isArray(data)) {
      return data.map((it) => {
        Object.entries(this.bitFields).forEach(([k, len]) => {
          result[k] = _getValue(it, len);
        });
        return result;
      }) as any;
    } else {
      Object.entries(this.bitFields).forEach(([k, len]) => {
        result[k] = _getValue(data as number, len);
      });
      return result as any;
    }
  }

  override encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = createDataView(this.count * this.size, view);

    const _getValue = (obj: any): number => {
      let val = 0;
      let count = 0;
      Object.entries<number>(obj).forEach(([k, v]) => {
        const len: number = this.bitFields![k];
        if (len !== undefined) {
          val |= v << count;
          count += len;
        }
      });
      return val;
    };

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.count; i++) {
        (v as any)[this.set](offset, _getValue(obj[i]), littleEndian);
        offset += this.size;
      }
      return v;
    } else {
      const val = _getValue(obj);
      (v as any)[this.set](offset, val, littleEndian);
      return v;
    }
  }
}

export class BoolType<
  D extends boolean,
  E extends boolean | number
> extends StructType<D, E> {
  constructor(typeName: string | string[], type: StructType<number, number>) {
    super(typeName, type.size, type.unsigned);
  }

  /**
   * ```
   * bool.decode([1])
   * => true
   *
   * BOOL.decode([0, 0, 0, 1])
   * => true
   * ```
   * @param view
   * @param littleEndian
   * @param offset
   */
  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ): D {
    let r = super.decode(view, littleEndian, offset) as any;
    if (Array.isArray(r)) {
      r = r.flat().map((it) => Boolean(it));
      r = unflattenDeep(r, this.deeps);
    } else {
      r = Boolean(r);
    }
    return r;
  }

  /**
   * ```
   * bool.encode(0)
   * => <00>
   *
   * BOOL.encode(0)
   * => <00 00 00 00>
   * ```
   * @param obj
   * @param littleEndian
   * @param offset
   * @param view
   */
  override encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    if (obj && Array.isArray(obj)) {
      obj = obj.flat().map((it) => Number(Boolean(it))) as any;
    } else if (obj) {
      obj = Number(Boolean(obj)) as any;
    }
    return super.encode(obj, littleEndian, offset, view);
  }
}

export class StringType extends StructType<string, string> {
  constructor() {
    super("string_t", 1, true);
  }

  textDecode = new TextDecoder();
  textEncoder = new TextEncoder();

  /**
   * ```
   * string_t[2].decode([0x61, 0x62, 0, 0x63])
   * => ab
   * ```
   */
  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    textDecode?: TextDecoder
  ) {
    view = makeDataView(view);
    textDecode ??= this.textDecode;

    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      let data = (view as any)[this.get](offset, littleEndian);
      if (data === 0) break;
      data = textDecode.decode(new Uint8Array([data]));
      result.push(data);
      offset += this.size;
    }

    // string_t[2] => 'ab'
    // string_t[2][1] => ['a', 'b']
    if (this.deeps.length < 2) return result.join("") as any;

    return this.isList ? unflattenDeep(result, this.deeps, true) : result[0];
  }

  /**
   * ```
   * string_t[2].encode("abcd" as any)
   * =>  <61 62>
   * ```
   */
  override encode(
    obj: string,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoder?: TextEncoder
  ): DataView {
    const v = createDataView(this.count * this.size, view);

    if (Array.isArray(obj)) (obj as any) = obj.flat().join("");

    textEncoder ??= this.textEncoder;

    const bytes: Uint8Array = textEncoder.encode(obj);

    for (let i = 0; i < this.count; i++) {
      const it = bytes[i] ?? 0;
      try {
        (v as any)[this.set](offset, it, littleEndian);
      } catch (error) {
        (v as any)[this.set](offset, BigInt(it), littleEndian);
      }
      offset += this.size;
    }

    return v;
  }
}

export class PaddingType extends StructType<number, number> {
  constructor() {
    super("padding_t", 1, true);
  }

  /**
   * ```
   * padding_t[2].decode([1, 2, 3])
   * => [ 1, 2 ]
   * ```
   * @param view
   * @param littleEndian
   * @param offset
   */
  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ) {
    view = makeDataView(view);
    let i = sizeof(this);
    const r: number[] = [];
    while (i--) {
      r.push((view as any)[this.get](offset, littleEndian));
      offset++;
    }
    return r as any;
  }

  /**
   *
   * ```
   * padding_t[10].encode(0 as any)
   * => <00 00 00 00 00 00 00 00 00 00>
   * ```
   *
   * @param zero
   * @param littleEndian
   * @param offset
   * @param view
   */
  override encode(
    zero: number = 0,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = createDataView(this.count * this.size, view);
    if (typeof zero !== "number") zero = 0;
    let length = sizeof(this);
    while (length-- > 0) v.setUint8(offset++, zero);
    return v;
  }
}

type HInjectDecode = (view: DataView, offset: number) => InjectNext;
type HInjectEncode = (value: any) => DecodeBuffer_t;

export class Inject extends StructType<any, any> {
  /**
   * Customize the working content of decode and encode
   */
  constructor(
    private hInjectDecode?: HInjectDecode,
    private hInjectEncode?: HInjectEncode
  ) {
    super("inject_t", 0, true);
  }

  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0
  ) {
    if (!this.hInjectDecode) return null;

    this.size = 0;
    view = makeDataView(view);

    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      const res = this.hInjectDecode(view as DataView, offset);

      result.push(res.value);
      offset += res.size;
      this.size += res.size;
    }

    return this.isList ? unflattenDeep(result, this.deeps, false) : result[0];
  }

  override encode(
    obj: any,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    view = createDataView(0, view);
    if (!this.hInjectEncode) return view;

    this.size = 0;
    for (let i = 0; i < this.count; i++) {
      const it = this.isList ? (obj as any)[i] : obj;
      const buf = makeDataView(this.hInjectEncode(it));

      view = realloc(view!, view!.byteLength + buf.byteLength, buf, offset);
      offset += buf.byteLength;
      this.size += buf.byteLength;
    }

    return view;
  }
}

/**
 *
 * Register a new type
 *
 * ```ts
 * const int = registerType(["int", "signed", "signed int"], 4, false);
 * ```
 * @param typeName
 * @param size
 * @param unsigned
 */
export function registerType<D extends number, E extends number>(
  typeName: string | string[],
  size: TypeSize_t,
  unsigned = true
) {
  return new StructType<D, E>(typeName, size, unsigned);
}

/**
 *
 * Inherit the "size" and "unsigned" attributes
 *
 * ```ts
 * const int8_t = typedef("int8_t", char);
 * ```
 * @param typeName
 * @param type
 */
export function typedef<D extends number, E extends number>(
  typeName: string | string[],
  type: StructType<any, any>
) {
  const newType = registerType<D, E>(typeName, type.size, type.unsigned);
  return newType;
}

export function bits(type: StructType<number, number>, obj: BitsType_t) {
  return new BitsType(type.size, obj);
}

export function bitFields(type: StructType<number, number>, obj: BitsType_t) {
  return new BitFieldsType(type.size, obj);
}

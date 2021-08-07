import { AnyObject, TypeSize_t } from "./interfaces";
import { sizeof } from "./struct-buffer";
import {
  arrayProxyNext,
  createDataView,
  makeDataView,
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
    public readonly size: TypeSize_t,
    public readonly unsigned: boolean
  ) {
    super();
    this.names = Array.isArray(typeName) ? typeName : [typeName];
    const [get, set] = typeHandle(this);
    this.set = set;
    this.get = get;
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
    view: ArrayBufferView | number[],
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
    [key in keyof BitsType_t]: 1 | 0;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: TypeSize_t, public readonly bits: BitsType_t) {
    super("<bits>", size, true);
  }

  decode(
    view: ArrayBufferView | number[],
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
        const result: { [k: string]: 0 | 1 } = {};
        Object.entries(this.bits).forEach(([k, i]) => {
          result[k] = ((it & (1 << i)) >> i) as 0 | 1;
        });
        return result;
      }) as any;
    } else {
      const result: { [k: string]: 0 | 1 } = {};
      Object.entries(this.bits).forEach(([k, i]) => {
        result[k] = (((data as number) & (1 << i)) >> i) as 0 | 1;
      });
      return result as any;
    }
  }

  encode(
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
  decode(
    view: ArrayBufferView | number[],
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
  encode(
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
  decode(
    view: ArrayBufferView | number[],
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
  encode(
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
  decode(
    view: ArrayBufferView | number[],
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
  encode(
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

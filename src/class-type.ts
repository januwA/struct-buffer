import { AbstractType } from "./abstract";
import {
  AnyObject,
  Bit_t,
  DecodeBuffer_t,
  IByteLength,
  IDecode,
  IEncode,
  IDecodeOptions,
  IEncodeOptions,
  DataViewSetBig_t,
  BitsType_t,
  HInjectDecode,
  HInjectEncode,
} from "./interfaces";
import { createDataView, makeDataView, realloc } from "./utils";

// D decode return type
// E encode obj type
export class StructType<D, E>
  extends AbstractType<StructType<D[], E[]>>
  implements IByteLength, IDecode<D>, IEncode<E>
{
  constructor(size: number, unsigned: boolean) {
    super(size, unsigned);
  }

  get byteLength(): number {
    return this.isList ? this.size * this.count : this.size;
  }

  /**
   *
   * ```ts
   * DWORD.decode( new Uint8Array([0,0,0,1]) ) => 1
   *
   * DWORD[2].decode( new Uint8Array([0,0,0,1, 0,0,0,2]) ) => [1, 2]
   * ```
   */
  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const v = makeDataView(view);
    let offset = options?.offset ?? 0;
    const result: (number | bigint)[] = [];
    let i = this.count;
    while (i--) {
      result.push(v[this.get](offset, options?.littleEndian));
      offset += this.size;
    }
    return this.unflattenDeep(result);
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
   */
  encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.count * this.size, options?.view);

    if (this.isList && Array.isArray(obj)) (obj as any) = obj.flat();

    let offset = options?.offset ?? 0;

    for (let i = 0; i < this.count; i++) {
      const it: number = (this.isList ? (obj as any)[i] : obj) ?? 0;

      try {
        v[this.set](offset, it, options?.littleEndian);
      } catch (error) {
        v[this.set as DataViewSetBig_t](
          offset,
          BigInt(it),
          options?.littleEndian
        );
      }
      offset += this.size;
    }

    return v;
  }
}

export class BitsType<
  D = {
    [key in keyof BitsType_t]: Bit_t;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: number, public readonly bits: BitsType_t) {
    super(size, true);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const data: number[] | number = super.decode(view, options) as any;

    const handle = (num: number) => {
      const result: { [k: string]: Bit_t } = {};
      Object.entries(this.bits).forEach(([k, i]) => {
        result[k] = (((num as number) & (1 << i)) >> i) as Bit_t;
      });
      return result as any;
    };

    if (this.isList && Array.isArray(data)) {
      return data.map((it) => handle(it)) as any;
    } else {
      return handle(data as number);
    }
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.count * this.size, options?.view);
    let offset = options?.offset ?? 0;

    const handle = (el: any) => {
      let flags = 0;
      Object.entries<number>(el).forEach(([k, v]) => {
        const i: number = this.bits![k];
        if (i !== undefined) flags |= v << i;
      });
      v[this.set](offset, flags, options?.littleEndian);
    };

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.count; i++) {
        handle(obj[i]);
        offset += this.size;
      }
    } else {
      handle(obj);
    }
    return v;
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
  constructor(size: number, public readonly bitFields: BitsType_t) {
    super(size, true);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const data: number[] | number = super.decode(view, options) as any;

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

    const handle = (num: number) => {
      Object.entries(this.bitFields).forEach(([k, len]) => {
        result[k] = _getValue(num, len);
      });
    };

    if (this.isList && Array.isArray(data)) {
      return data.map((it) => {
        return handle(it), result;
      }) as any;
    } else {
      return handle(data as number), result as any;
    }
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.count * this.size, options?.view);

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

    let offset = options?.offset ?? 0;

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.count; i++) {
        v[this.set](offset, _getValue(obj[i]), options?.littleEndian);
        offset += this.size;
      }
    } else {
      v[this.set](offset, _getValue(obj), options?.littleEndian);
    }
    return v;
  }
}

export class BoolType<
  D extends boolean,
  E extends boolean | number
> extends StructType<D, E> {
  constructor(type: StructType<number, number>) {
    super(type.size, type.unsigned);
  }

  /**
   * ```
   * bool.decode([1])
   * => true
   *
   * BOOL.decode([0, 0, 0, 1])
   * => true
   * ```
   */
  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    let r = super.decode(view, options) as any;
    if (Array.isArray(r)) {
      r = r.flat().map((it) => Boolean(it));
      r = this.unflattenDeep(r);
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
   */
  override encode(obj: E, options?: IEncodeOptions): DataView {
    if (obj && Array.isArray(obj)) {
      obj = obj.flat().map((it) => Number(Boolean(it))) as any;
    } else if (obj) {
      obj = Number(Boolean(obj)) as any;
    }
    return super.encode(obj, options);
  }
}

export class StringType extends StructType<string, string> {
  constructor(
    private readonly textDecode = new TextDecoder(),
    private readonly textEncoder = new TextEncoder()
  ) {
    super(1, true);
  }

  /**
   * ```
   * string_t[2].decode([0x61, 0x62, 0, 0x63])
   * => ab
   * ```
   */
  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    const v = makeDataView(view);

    let offset = options?.offset ?? 0;

    const result: string[] = [];
    let i = this.count;
    while (i--) {
      let data = v[this.get](offset, options?.littleEndian) as number;
      if (data === 0) break;
      result.push(this.textDecode.decode(new Uint8Array([data])));
      offset += this.size;
    }

    // string_t[2] => 'ab'
    // string_t[2][1] => ['a', 'b']
    if (this.deeps.length < 2) return result.join("") as any;

    return this.unflattenDeep(result, true);
  }

  /**
   * ```
   * string_t[2].encode("abcd" as any)
   * =>  <61 62>
   * ```
   */
  override encode(obj: string, options?: IEncodeOptions): DataView {
    const v = createDataView(this.count * this.size, options?.view);

    if (Array.isArray(obj)) (obj as any) = obj.flat().join("");

    let offset = options?.offset ?? 0;

    const bytes: Uint8Array = this.textEncoder.encode(obj);

    for (let i = 0; i < this.count; i++) {
      const it = bytes[i] ?? 0;
      try {
        v[this.set](offset, it, options?.littleEndian);
      } catch (error) {
        v[this.set as DataViewSetBig_t](
          offset,
          BigInt(it),
          options?.littleEndian
        );
      }
      offset += this.size;
    }

    return v;
  }
}

export class PaddingType extends StructType<number, number> {
  constructor() {
    super(1, true);
  }

  /**
   * ```
   * padding_t[2].decode([1, 2, 3])
   * => [ 1, 2 ]
   * ```
s   */
  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    const v = (view = makeDataView(view));
    let offset = options?.offset ?? 0;

    let i = this.byteLength;
    const r: (number | bigint)[] = [];
    while (i--) {
      r.push(v[this.get](offset, options?.littleEndian));
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
   */
  override encode(zero: number = 0, options?: IEncodeOptions): DataView {
    const v = createDataView(this.count * this.size, options?.view);
    let offset = options?.offset ?? 0;

    if (typeof zero !== "number") zero = 0;
    let length = this.byteLength;
    while (length-- > 0) v.setUint8(offset++, zero);
    return v;
  }
}

export class Inject extends StructType<any, any> {
  /**
   * Customize the working content of decode and encode
   */
  constructor(
    private readonly hInjectDecode?: HInjectDecode,
    private readonly hInjectEncode?: HInjectEncode
  ) {
    super(0, true);
  }

  override get byteLength(): number {
    return this.size;
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    if (!this.hInjectDecode) return null;

    this.size = 0;
    view = makeDataView(view);

    let offset = options?.offset ?? 0;

    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      const res = this.hInjectDecode(view as DataView, offset);

      result.push(res.value);
      offset += res.size;
      this.size += res.size;
    }

    return this.unflattenDeep(result, false);
  }

  override encode(obj: any, options?: IEncodeOptions): DataView {
    let view = createDataView(0, options?.view);
    if (!this.hInjectEncode) return view;

    let offset = options?.offset ?? 0;

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

export class FloatType extends StructType<number, number> {
  override get isFloat(): boolean {
    return true;
  }

  constructor() {
    super(4, true);
  }
}

export class DoubleType extends StructType<number, number> {
  override get isDouble(): boolean {
    return true;
  }

  constructor() {
    super(8, true);
  }
}

/**
 *
 * Register a new type
 *
 */
export function registerType<D extends number, E extends number>(
  size: number,
  unsigned = true
) {
  return new StructType<D, E>(size, unsigned);
}

/**
 *
 * Inherit the "size" and "unsigned" attributes
 *
 */
export function typedef<D extends number, E extends number>(
  type: StructType<any, any>
) {
  const newType = registerType<D, E>(type.size, type.unsigned);
  return newType;
}

export function bits(type: StructType<number, number>, obj: BitsType_t) {
  return new BitsType(type.size, obj);
}

export function bitFields(type: StructType<number, number>, obj: BitsType_t) {
  return new BitFieldsType(type.size, obj);
}

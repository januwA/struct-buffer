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
  COUNT,
  createDataView,
  createTextDecoder,
  createTextEncoder,
  isRef,
  makeDataView,
  realloc,
  Ref,
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

/**
 * 类型推导用的唯一 symbol 键(见 `InferType`).
 *
 * 用 unique symbol 而不是普通字段名: 它不可能和用户的字段名撞车, 也不会被误当成
 * 某个内联对象字面量的成员. 纯类型声明, 运行时不存在.
 */
export declare const VALUE_TYPE: unique symbol;

/**
 * encode 入参类型的 phantom 键, 与 `VALUE_TYPE` 成对使用(见 `FieldSpec`).
 * 纯类型声明, 运行时不存在.
 */
export declare const ENCODE_VALUE_TYPE: unique symbol;

/**
 * variant 分支表类型的 phantom 键. 分支字段在运行时是**平铺**进父对象的, 所以父
 * 对象要自己把各分支的字段并进来(见 `InferDef` 的 variant 处理).
 * 纯类型声明, 运行时不存在.
 */
export declare const VARIANT_CASES: unique symbol;

// D decode return type
// E encode obj type
export class StructType<D, E> extends Array<StructType<D[], E[]>> {
  names: string[];
  deeps: (number | Ref)[] = [];

  /**
   * phantom: 声明"我这个类型解码出来是 D", 运行时**不存在**这个属性, 也没有任何
   * 代码读它.
   *
   * 为什么不让 `InferType` 直接用 `T extends StructType<infer V, any>`: 那条路对
   * `uint8_t`(= `StructType<number,number>` 本体)有效, 但对**子类**会推成 `any` ——
   * `StructType` 继承自 `Array`, 下标签名 `StructType<D[],E[]>` 自引用, TS 从子类
   * 结构反推基类类型参数时推不出来. `string_t`(StringType)就中招, 而它恰恰是最常
   * 用的类型. 挂一个必选的 phantom 属性就绕开了整件事: 不做结构推断, 直接读字段.
   */
  declare readonly [VALUE_TYPE]: D;

  /**
   * ```
   * float[2] => true
   * float    => false
   * ```
   */
  get isList(): boolean {
    return !!this.deeps.length;
  }

  get isDynamic(): boolean {
    return this.deeps.some((it) => isRef(it));
  }

  get refField(): string | undefined {
    const r = this.deeps.find((it) => isRef(it));
    return (r as any)?.field;
  }

  get count(): number {
    return this.getCount();
  }

  /**
   * 元素个数. `ctx[COUNT]` 是 Field 引擎解析完 ref 后回灌的显式元素数, 优先级最高:
   * 只有它能让**覆写了 decode/encode 的子类型**(bits/bool/string_t/自定义类型)在
   * ref 驱动列表下拿到正确个数, 而不必给每个子类各写一份 count 感知的实现.
   * ctx 为普通对象时无副作用, 未走 Field 引擎的老调用完全不受影响。
   */
  getCount(ctx?: any): number {
    if (ctx) {
      const n = ctx[COUNT];
      if (typeof n === "number") return n;
    }
    return this.deeps.reduce((acc: number, it) => {
      let val: number;
      if (isRef(it)) {
        val = it.resolve(ctx);
      } else {
        val = Number(it);
      }
      return acc * val;
    }, 1);
  }

  getDeeps(ctx?: any): number[] {
    return this.deeps.map((it) => {
      if (isRef(it)) {
        return it.resolve(ctx);
      }
      return Number(it);
    });
  }

  getSize(ctx?: any): number {
    if (this.isList) {
      return this.size * this.getCount(ctx);
    }
    return this.size;
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
   * @param textDecodeOrCtx
   * @param ctx
   */
  decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ): D {
    view = makeDataView(view);
    const actualCtx =
      ctx ?? (textDecodeOrCtx && !textDecodeOrCtx.decode ? textDecodeOrCtx : undefined);
    const count = this.getCount(actualCtx);

    const result: AnyObject[] = [];
    let i = count;
    while (i--) {
      result.push((view as any)[this.get](offset, littleEndian));
      offset += this.size;
    }
    const deeps = this.getDeeps(actualCtx);
    return this.isList ? unflattenDeep(result, deeps, false) : result[0];
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
   * @param textEncoderOrCtx
   * @param ctx
   */
  encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    const actualCtx =
      ctx ?? (textEncoderOrCtx && !textEncoderOrCtx.encode ? textEncoderOrCtx : obj);
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    if (this.isList && Array.isArray(obj)) (obj as any) = obj.flat();

    for (let i = 0; i < count; i++) {
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
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset,
      textDecodeOrCtx,
      ctx
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
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    const actualCtx =
      ctx ?? (textEncoderOrCtx && !textEncoderOrCtx.encode ? textEncoderOrCtx : obj);
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < count; i++) {
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
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset,
      textDecodeOrCtx,
      ctx
    ) as any;

    /**
     * 从 `data` 的第 0 位开始按声明顺序切出所有位域.
     * 游标必须是**函数内部**的局部量: 旧实现把它提到闭包里, 于是列表第 2 个元素
     * 接着第 1 个元素读完的位置继续切, 结果全 0.
     */
    const _unpack = (data: number): BitsType_t => {
      let i = 0;
      const out: BitsType_t = {};
      Object.entries(this.bitFields).forEach(([k, len]) => {
        let val = 0;
        for (let b = 0; b < len; b++, i++) val |= ((data >> i) & 1) << b;
        out[k] = val;
      });
      return out;
    };

    if (this.isList && Array.isArray(data)) {
      return data.map((it) => _unpack(it)) as any;
    }
    return _unpack(data as number) as any;
  }

  override encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    const actualCtx =
      ctx ?? (textEncoderOrCtx && !textEncoderOrCtx.encode ? textEncoderOrCtx : obj);
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    /**
     * 必须按 `bitFields` 的**声明顺序**铺位, 和 decode 的读法完全一致.
     * 旧实现遍历 `Object.entries(obj)`, 于是位移取决于调用方字面量的键顺序:
     * 同一份声明 `{a:1,b:1,c:1}`, 传 `{a:1,c:1}` 会把 c 铺到 bit1 而不是 bit2,
     * 写出来的字节自己都解不回去.
     */
    const _getValue = (obj: any): number => {
      let val = 0;
      let count = 0;
      Object.entries<number>(this.bitFields).forEach(([k, len]) => {
        const v = (obj as any)?.[k] ?? 0;
        val |= v << count;
        count += len;
      });
      return val;
    };

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < count; i++) {
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
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ): D {
    const actualCtx =
      ctx ?? (textDecodeOrCtx && !textDecodeOrCtx.decode ? textDecodeOrCtx : undefined);
    let r = super.decode(view, littleEndian, offset, textDecodeOrCtx, ctx) as any;
    if (Array.isArray(r)) {
      r = r.flat().map((it) => Boolean(it));
      r = unflattenDeep(r, this.getDeeps(actualCtx));
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
   * @param textEncoderOrCtx
   * @param ctx
   */
  override encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    if (obj && Array.isArray(obj)) {
      obj = obj.flat().map((it) => Number(Boolean(it))) as any;
    } else if (obj) {
      obj = Number(Boolean(obj)) as any;
    }
    return super.encode(obj, littleEndian, offset, view, textEncoderOrCtx, ctx);
  }
}

export class StringType extends StructType<string, string> {
  constructor() {
    super("string_t", 1, true);
  }

  textDecode = createTextDecoder();
  textEncoder = createTextEncoder();

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
    textDecode?: TextDecoder,
    ctx?: any
  ) {
    view = makeDataView(view);
    textDecode ??= this.textDecode;

    const count = this.getCount(ctx);
    const result: AnyObject[] = [];
    let i = count;
    while (i--) {
      let data = (view as any)[this.get](offset, littleEndian);
      if (data === 0) break;
      data = textDecode.decode(new Uint8Array([data]));
      result.push(data);
      offset += this.size;
    }

    // string_t[2] => 'ab'
    // string_t[2][1] => ['a', 'b']
    const deeps = this.getDeeps(ctx);
    if (deeps.length < 2) return result.join("") as any;

    return this.isList ? unflattenDeep(result, deeps, true) : result[0];
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
    textEncoder?: TextEncoder,
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? obj;
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    if (Array.isArray(obj)) (obj as any) = obj.flat().join("");

    textEncoder ??= this.textEncoder;

    const bytes: Uint8Array = textEncoder.encode(obj);

    for (let i = 0; i < count; i++) {
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
   * @param textDecodeOrCtx
   * @param ctx
   */
  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ) {
    const actualCtx = ctx ?? textDecodeOrCtx;
    view = makeDataView(view);
    let i = this.getSize(actualCtx);
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
   * @param textEncoderOrCtx
   * @param ctx
   */
  override encode(
    zero: number = 0,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? textEncoderOrCtx;
    const v = createDataView(this.getSize(actualCtx), view);
    if (typeof zero !== "number") zero = 0;
    let length = this.getSize(actualCtx);
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
    offset: number = 0,
    textDecodeOrCtx?: any,
    ctx?: any
  ) {
    if (!this.hInjectDecode) return null;

    const actualCtx = ctx ?? textDecodeOrCtx;
    this.size = 0;
    view = makeDataView(view);

    const result: AnyObject[] = [];
    let i = this.getCount(actualCtx);
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
    view?: DataView,
    textEncoderOrCtx?: any,
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? textEncoderOrCtx;
    view = createDataView(0, view);
    if (!this.hInjectEncode) return view;

    this.size = 0;
    for (let i = 0; i < this.getCount(actualCtx); i++) {
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

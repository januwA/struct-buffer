import {
  AnyObject,
  Bit_t,
  DecodeBuffer_t,
  TypeSize_t,
} from "./interfaces";
import {
  arrayProxyNext,
  COUNT,
  createDataView,
  isRef,
  makeDataView,
  Ref,
  unflattenDeep,
} from "./utils";

/**
 * 线上的字节形状只有两类: 整数和浮点。这是选访问器的**唯一**依据。
 *
 * 之前这里靠"名字里有没有 float"来判断 —— 因为 `float` 的 size 是 4、unsigned 是 true,
 * 光看这两个属性只能落到 `getUint32`, 于是得反过来查名字。代价是别名会掉队:
 * `typedef("my_float", float)` 造出来的类型不含 "float" 这个名字, 于是静默按整数读写
 * (`1.5` 编成 `00 00 00 01`, 不报错、字节还合法)。名字是给人看的, 不该参与派发。
 */
export type TypeKind = "int" | "float";

/** [DataView 读方法, DataView 写方法, 该类型是否走 BigInt 访问器] */
type TypeHandle_t = [get: string, set: string, isBig: boolean];

const intHandle: any = {
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
};

/** 浮点没有 2 字节形态, 宽度就是 4 或 8 */
const floatHandle: any = {
  4: "getFloat32",
  8: "getFloat64",
};

function typeHandle(type: StructType<any, any, any>): TypeHandle_t {
  const h: string | undefined =
    type.kind === "float"
      ? floatHandle[type.size]
      : intHandle[type.size]?.[+type.unsigned];

  if (!h) {
    throw new Error(
      `StructType: 不存在这种字节形状 (size=${type.size}, ` +
        `unsigned=${type.unsigned}, kind=${type.kind})`
    );
  }

  return [h, h.replace(/^g/, "s"), h.startsWith("getBig")];
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
/**
 * `T[n]` 的形态 = `Idx`。默认是"再多一维的 T", 但那个默认值不能直接写成
 * `StructType<D[], E[]>`(会判成循环默认), 也不能靠接口间接(TS 一样看得穿)。
 * 所以用 `[Idx] extends [never]` 断开: 方括号防止条件类型对 `never` 分配。
 *
 * 只有"1 字节无符号"这一种类型会把 `Idx` 换成字节形态(见 `ByteListType`)。
 */
export class StructType<D, E, Idx = never> extends Array<
  [Idx] extends [never] ? StructType<D[], E[]> : Idx
> {
  deeps: (number | Ref)[] = [];

  /**
   * phantom: 声明"我这个类型解码出来是 D", 运行时**不存在**这个属性, 也没有任何
   * 代码读它.
   *
   * 为什么不让 `InferType` 直接用 `T extends StructType<infer V, any>`: 那条路对
   * `uint8_t`(= `StructType<number,number>` 本体)有效, 但对**子类**会推成 `any` ——
   * `StructType` 继承自 `Array`, 下标签名 `StructType<D[],E[]>` 自引用, TS 从子类
   * 结构反推基类类型参数时推不出来. `bits(...)` / `bitFields(...)` 就中招, 而它们
   * 是最常用的类型. 挂一个必选的 phantom 属性就绕开了整件事: 不做结构推断, 直接读字段.
   */
  declare readonly [VALUE_TYPE]: D;

  /**
   * phantom: encode **入参**类型。绝大多数类型解出来是什么就收什么(`E` 跟 `D` 一样),
   * 字节段也是 —— 解出来是 `Uint8Array`, 收进去同样只收 `Uint8Array`, 字节只有一种形态。
   *
   * 唯一分叉的是位域: `BitsType` / `BitFieldsType` 的 `E` 是 `Partial<D>`, 也就是
   * "子对象可以只写要覆盖的字段", 而解码结果 `D` 是满的。
   */
  declare readonly [ENCODE_VALUE_TYPE]: E;

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
   * 只有它能让**覆写了 decode/encode 的子类型**(bits/bitFields/自定义类型)在
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

  /**
   * 我是不是"一段字节"。
   *
   * 判据: 1 字节无符号, 且形状只有一个维度。`uint8_t[3]` / `uint8_t[ref("len")]` 在线上
   * 就是 3 个 / len 个**连续**字节, 解出来自然该是一段字节而不是 `number[]` —— 同一串
   * 字节不该有两种解法, 而 `blob(n)` 曾经就是那个多出来的第二种。
   *
   * 两个反例:
   *
   * - 嵌套(`uint8_t[2][3]`)不算: 形状对调用方有意义(第一行 / 第二行), 保持嵌套数组
   * - `int8_t[3]` 不算: 有符号要做符号扩展, 那是**取值转换**而不是字节重解释。混进来
   *   等于库替调用方挑了怎么读, 和这库一贯的做法相反
   */
  public get isByteRun(): boolean {
    return this.size === 1 && this.unsigned && this.deeps.length === 1;
  }

  get: string;
  set: string;

  /**
   * 该类型是否走 `getBigInt64` / `setBigInt64` 一族的访问器。
   * 声明的值类型始终是 `number`, 转换统一收在 decode/encode 里做:
   * 免得类型撒谎(旧引擎把 bigint 原样抛给调用方, 新引擎的 `Cursor.u64` 给的是 number)。
   */
  readonly isBig: boolean;

  constructor(
    public size: TypeSize_t,
    public readonly unsigned: boolean,
    public readonly kind: TypeKind = "int"
  ) {
    super();

    if (this.size) {
      const [get, set, isBig] = typeHandle(this);
      this.set = set;
      this.get = get;
      this.isBig = isBig;
    } else {
      this.set = this.get = "";
      this.isBig = false;
    }
    return arrayProxyNext(this, StructTypeNext);
  }

  /**
   * 写进 DataView 前把值调到访问器要的形态。
   * `setBigInt64` 只收 bigint, `setUint8` 只收 number —— 之前靠"先抛 TypeError 再
   * 兜底重试"来区分, 那条路径在 encode 的 catch 里, 一旦真的越界会把原始错误盖掉。
   */
  protected toRaw(value: any): any {
    return this.isBig ? BigInt(value) : value;
  }

  /**
   *
   * ```ts
   * uint32_t.decode( new Uint8Array([0,0,0,1]) ) => 1
   *
   * uint32_t[2].decode( new Uint8Array([0,0,0,1, 0,0,0,2]) ) => [1, 2]
   *
   * uint8_t[3].decode( new Uint8Array([1,2,3]) ) => <01 02 03>   // 字节, 不是 [1,2,3]
   * ```
   *
   * @param view
   * @param littleEndian
   * @param offset
   * @param ctx
   */
  decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    ctx?: any
  ): D {
    view = makeDataView(view);

    // 字节段直接切片, 不逐个走访问器 —— 结果本来就是一段内存。
    // slice(): 交出去的是副本, 调用方之后改原缓冲不会污染已解出的值
    if (this.isByteRun) {
      const n = this.getCount(ctx);
      return new Uint8Array(
        view.buffer,
        view.byteOffset + offset,
        n
      ).slice() as unknown as D;
    }

    const count = this.getCount(ctx);

    const result: AnyObject[] = [];
    let i = count;
    while (i--) {
      const v = (view as any)[this.get](offset, littleEndian);
      // 8 字节类型走 DataView 的 BigInt 访问器, 但声明的值类型是 number: 统一收窄,
      // 调用方拿到的一律是 number, 不用再自己判断 bigint
      result.push(this.isBig ? Number(v) : v);
      offset += this.size;
    }
    const deeps = this.getDeeps(ctx);
    return this.isList ? unflattenDeep(result, deeps, false) : result[0];
  }

  /**
   *
   * ```ts
   * uint32_t.encode(4)         => <00 00 00 02>
   *
   * uint32_t[2].encode([1,2])  => <00 00 00 01 00 00 00 02>
   *
   * // padding zero
   * uint32_t[2].encode([1])    => <00 00 00 01 00 00 00 00>
   * ```
   *
   * @param obj
   * @param littleEndian
   * @param offset
   * @param view
   * @param ctx
   */
  encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? obj;
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    if (this.isList && Array.isArray(obj)) (obj as any) = obj.flat();

    for (let i = 0; i < count; i++) {
      const it = (this.isList ? (obj as any)[i] : obj) ?? 0;
      (v as any)[this.set](offset, this.toRaw(it), littleEndian);
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
    super(size, true);
  }

  // 位域解出来是对象, 不是字节。底层那层 number[] 是位映射的输入(见 decode),
  // 换成 Uint8Array 会让 `Array.isArray` 判断落空, 一个列表被当成单值
  public override get isByteRun(): boolean {
    return false;
  }

  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    ctx?: any
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset,
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
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? obj;
    const count = this.getCount(actualCtx);
    const v = createDataView(count * this.size, view);

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < count; i++) {
        let flags = 0;
        Object.entries<number>(obj[i]).forEach(([k, v]) => {
          const i: number = this.bits![k];
          if (i !== undefined) flags |= v << i;
        });
        (v as any)[this.set](offset, this.toRaw(flags), littleEndian);
        offset += this.size;
      }

      return v;
    } else {
      let flags = 0;
      Object.entries<number>(obj as any).forEach(([k, v]) => {
        const i: number = this.bits![k];
        if (i !== undefined) flags |= v << i;
      });
      (v as any)[this.set](offset, this.toRaw(flags), littleEndian);
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
    super(size, true);
  }

  // 同 BitsType: 位域是对象, 底层 number[] 要留给位映射
  public override get isByteRun(): boolean {
    return false;
  }

  override decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    ctx?: any
  ): D {
    const data: number[] | number = super.decode(
      view,
      littleEndian,
      offset,
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
    ctx?: any
  ): DataView {
    const actualCtx = ctx ?? obj;
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
        (v as any)[this.set](offset, this.toRaw(_getValue(obj[i])), littleEndian);
        offset += this.size;
      }
      return v;
    } else {
      const val = _getValue(obj);
      (v as any)[this.set](offset, this.toRaw(val), littleEndian);
      return v;
    }
  }
}

/**
 * `uint8_t` 的列表形态: 解出来是一段字节。
 *
 * encode 入参和解码值都是 `Uint8Array` —— 字节只有一种形态。解出来的类型靠 phantom
 * `VALUE_TYPE` 携带(见 `StructType`), 所以 `InferType` / `InferEncode` 自动跟着走,
 * 推导侧不需要特判。
 */
export type ByteListType = StructType<Uint8Array, Uint8Array>;

/**
 * 注册一个新类型。参数就是线上的字节形状, 没有类型名 —— 名字对编解码毫无用处。
 *
 * ```ts
 * const int = registerType(4, false); // 4 字节有符号整数
 * const f32 = registerType(4, true, "float"); // 4 字节浮点
 * ```
 * @param size 字节宽度, 只支持 1 / 2 / 4 / 8
 * @param unsigned 整数才看这个; 传 `0` 当"定长未知"的占位, 见 types.ts 的 docstring
 * @param kind 整数或浮点
 */
export function registerType(
  size: 1,
  unsigned: true,
  kind?: "int"
): StructType<number, number, ByteListType>;
export function registerType<D extends number, E extends number>(
  size: TypeSize_t,
  unsigned?: boolean,
  kind?: TypeKind
): StructType<D, E>;
export function registerType<D extends number, E extends number>(
  size: TypeSize_t,
  unsigned = true,
  kind: TypeKind = "int"
) {
  return new StructType<D, E>(size, unsigned, kind);
}

export function bits(type: StructType<any, any, any>, obj: BitsType_t) {
  return new BitsType(type.size, obj);
}

export function bitFields(type: StructType<any, any, any>, obj: BitsType_t) {
  return new BitFieldsType(type.size, obj);
}

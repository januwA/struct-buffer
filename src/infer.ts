import type {
  ENCODE_VALUE_TYPE,
  VALUE_TYPE,
  VARIANT_CASES,
} from "./class-type";
import type { Def } from "./field";
import type { DynamicStructBuffer } from "./dynamic-struct-buffer";

/**
 * 从字段声明推导解码结果类型。
 *
 * 全部推导都走一个入口: `[VALUE_TYPE]` phantom 属性(`StructType` 与 `FieldSpec` 上
 * 都有, 运行时都不存在)。不写 `T extends StructType<infer V, any>` 是有原因的 ——
 * 那条路对 `uint8_t` 有效, 但对**子类**会推成 `any`(`StructType` 继承自 `Array` 且
 * 下标签名 `StructType<D[], E[]>` 自引用, TS 从子类结构反推基类类型参数推不出来),
 * `bits(...)` / `bitFields(...)` 正好中招。读 phantom 字段不做结构推断, 绕开整个问题。
 *
 * 关键效果是**下标即数组**: `StructType<D, E> extends Array<StructType<D[], E[]>>`
 * 让下标操作在类型层面把 D 推成数组, 所以
 *
 * ```ts
 * uint8_t              => number
 * uint8_t[2]           => number[]
 * uint8_t[2][3]        => number[][]
 * uint8_t[ref("len")]  => number[]
 * ```
 *
 * 旧版 `ref()` 声明成 `any`, 推导到 `uint8_t[ref("len")]` 就断了; 改成 `RefIndex`
* (运行时是 Ref 对象, 类型上是 number)之后才能穿过长度前缀。
 *
 * **有意不管的一处**:
 *
 * - `variant` / `discriminated`: 分支字段在运行时是**平铺**进父对象的, 所以类型上
 *   由 `VariantExtras` 把各分支的字段并进父对象(都可选); 但"哪个分支生效"取决于
 *   判别字段的运行时值, 静态没法收窄成一个 union, 字段自己仍按各分支的类型给出.
 *
 * 非对象原样透传(`InferType<number>` 就是 `number`), 因此对已经解码出来的对象
 * 再套一层是幂等的。
 */
export type InferType<T> = T extends { [VALUE_TYPE]: infer V }
  ? V // uint8_t / bits / uint8_t[ref(...)] / rest() / framed()
  : InferShape<T>;

/** 结构体来源(嵌套字段/`records` 的参数)的值类型 */
export type InferSource<T> = T extends Def
  ? any // 归一化后的运行时形态, 类型信息已丢失
  : InferShape<T>;

type InferShape<T> = T extends DynamicStructBuffer<any, infer V, any>
  ? V // D 的默认值就是 InferDef<S>; 下标把它推成数组, 这里直接读
  : T extends object
    ? { [K in keyof T]: InferType<T[K]> } // 内联对象 = 匿名子结构体
    : T; // 非对象 = 已经是解码后的值(number/string/Uint8Array...), 原样透传

/** 联合 -> 交叉(为了把 variant 的各分支合并) */
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

/** 摊平交叉类型, 让错误信息里显示的是一个对象而不是 `A & B` */
type Flatten<T> = { [K in keyof T]: T[K] } & {};

/** variant 一个分支贡献到父对象的字段 */
type BranchExtras<C> = Partial<
  UnionToIntersection<{ [CK in keyof C]: InferType<C[CK]> }[keyof C]>
>;

/**
 * variant 的分支字段在运行时是**平铺**进父对象的, 所以父对象的类型里必须有它们 ——
 * 否则 `encode({msg_type: 1, name: "abc"})` 会因"多余属性"编译不过, 而这对调用方
 * 是完全合法的写法. 各分支的字段都是可选的(哪个分支生效取决于判别字段的运行时值,
 * 静态收窄留给调用方), 所以合并后一律 Partial.
 *
 * 注意非 variant 字段贡献的是 `{}` 而不是 `unknown`: `unknown | X` 会塌成
 * `unknown`, 整个 `VariantExtras` 就白算了.
 */
type VariantExtras<S> = UnionToIntersection<
  {
    [K in keyof S]: S[K] extends { [VARIANT_CASES]: infer C }
      ? BranchExtras<C>
      : {};
  }[keyof S]
>;

/**
 * 整个字段表 -> 解码结果类型.
 *
 * 写成 `S extends any ?` 是为了让映射类型在联合类型上**分配**(`{a} | {b}` 各推各的),
 * 而不是先把 key 求交.
 *
 * `as` 那一截把值为 `never` 的键整个去掉 —— 那是 `skip(n)` 声明的"这里不是数据".
 * 不去掉的话协议表里一半的 `_unk0/_1/_2` 会出现在结果类型和结果对象里, 消费方每次
 * 构造上报结构都得手写"不含那几个键", 而类型会拒绝这种对象(它确实少字段).
 *
 * 幂等: 对已经是解码结果形状的类型再套一层得到同样的形状(`InferDef<InferDef<S>>`
 * 等于 `InferDef<S>`), 所以可以随手用在辅助类型上.
 */
export type InferDef<S> = S extends any
  ? Flatten<
      { [K in keyof S as InferType<S[K]> extends never ? never : K]: InferType<S[K]> } &
        VariantExtras<S>
    >
  : never;

/**
 * encode 入参类型. 和解码值类型**故意**分开推: `rest()` 解出来是 `Uint8Array`, 写回去
 * 却接受字节数组; `uint8_t[n]` 同理; 嵌套子结构体则用 `E`(默认 `Partial<D>`), 也就是
 * "子对象可以只写要覆盖的字段"。
 */
export type InferEncode<T> = T extends { [ENCODE_VALUE_TYPE]: infer V }
  ? V // rest() / records() / framed(): 工厂自己声明入参类型
  : T extends DynamicStructBuffer<any, any, infer V>
    ? V // 嵌套子结构体: Partial<D>
    : InferType<T>; // 其余字段: 入参就是解码值类型(能不能省由外层 Partial 决定)

/** 整个字段表 -> encode 入参类型(`skip(n)` 的键同样去掉) */
export type InferEncodeDef<S> = S extends any
  ? Flatten<
      { [K in keyof S as InferEncode<S[K]> extends never ? never : K]: InferEncode<S[K]> } &
        VariantExtras<S>
    >
  : never;

import { Cursor } from "./cursor";
import {
  BitFieldsNode,
  BitsNode,
  BytesNode,
  CodecNode,
  decodeStruct,
  ErrorSink,
  FieldNode,
  fixedSize,
  isRef,
  Len,
  ListNode,
  Node,
  readNode,
  Ref,
  ScalarNode,
  scalarHandle,
  SkipNode,
  StructNode,
  TypeKind,
  VariantNode,
  writeNode,
  writeStruct,
} from "./engine";
import { LenientResult } from "./errors";
import { AnyObject, Bit_t, DecodeBuffer_t, TypeSize_t } from "./interfaces";
import { Writer } from "./writer";

/**
 * 声明层: 把构造器编译成 engine 的 AST, 并挂上 phantom 类型.
 *
 * 这里没有第二套运行时 —— 每个构造器只做两件事: 组装 `Node`, 声明"它解出来是什么"
 * (phantom symbol). 类型推导全部走 phantom, 不做结构反推, 所以子类/惰性构造都不会
 * 让推导退化成 `any`。
 */

// ------------------------------------------------------------ phantom 类型

export declare const DECODE: unique symbol;
export declare const ENCODE: unique symbol;
export declare const VARIANT_CASES: unique symbol;

/**
 * 一段 schema. `D` 是解码值类型, `E` 是 encode 入参类型(默认同 `D`)。
 *
 * 两个 phantom 都是**纯类型声明**, 运行时不存在 —— 运行时形态只有 `node` 加上
 * `decode`/`encode` 这组便利方法(等价于 `readNode`/`writeNode` 的根入口)。
 */
export interface Codec<D, E = D> {
  readonly [DECODE]: D;
  readonly [ENCODE]: E;
  decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): D;
  decodeLenient(
    view: DecodeBuffer_t,
    littleEndian?: boolean,
    offset?: number
  ): LenientResult<D>;
  encode(
    value: E,
    littleEndian?: boolean,
    offset?: number,
    view?: DataView
  ): DataView;
}

/** 运行时载荷: 构造器造出来的对象(带 phantom 类型的对象字面量) */
type Runtime = { readonly node: Node };

function make<D, E = D>(node: Node): Codec<D, E> {
  const codec = {
    node,
    decode(view: DecodeBuffer_t, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      return readNode(node, c, "value", littleEndian, {});
    },
    decodeLenient(view: DecodeBuffer_t, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      const sink: ErrorSink = { errors: [], stopped: false };
      const value = readNode(node, c, "value", littleEndian, {}, sink);
      return { value, errors: sink.errors, consumed: c.pos - offset };
    },
    encode(value: any, littleEndian = false, offset = 0, view?: DataView) {
      const w = new Writer({ view, offset, littleEndian });
      writeNode(node, w, value, "value", littleEndian, {});
      return w.finish();
    },
  };
  return codec as unknown as Codec<D, E>;
}

function nodeOf(codec: Codec<any, any>): Node {
  return (codec as unknown as Runtime).node;
}

// ------------------------------------------------------------ 类型推导

type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (
  k: infer I
) => void
  ? I
  : never;

type Flatten<T> = { [K in keyof T]: T[K] } & {};

/**
 * 从任意 schema 推出解码值类型。非 schema 原样透传(幂等), 所以同一套映射既能作用在
 * 声明上, 也能作用在已经解出来的形状上。
 */
export type InferType<T> = T extends { [DECODE]: infer D }
  ? D
  : T extends object
    ? { [K in keyof T]: InferType<T[K]> }
    : T;

/** encode 入参类型: 位域是 `Partial<D>`, 其余与解码值一致 */
export type InferEncode<T> = T extends { [ENCODE]: infer E }
  ? E
  : InferType<T>;

/** variant 一个分支贡献到父对象的字段(可选) */
type BranchExtras<C> = Partial<
  UnionToIntersection<{ [CK in keyof C]: InferType<C[CK]> }[keyof C]>
>;

/**
 * variant 的分支字段在运行时**平铺**进父对象, 所以父对象类型里必须有它们 ——
 * 否则 `encode({ msg_type: 1, name })` 会因"多余属性"编译不过。非 variant 字段
 * 贡献 `{}` 而不是 `unknown`(`unknown | X` 会塌成 `unknown`)。
 */
type VariantExtras<S> = UnionToIntersection<
  {
    [K in keyof S]: S[K] extends { [VARIANT_CASES]: infer C }
      ? BranchExtras<C>
      : {};
  }[keyof S]
>;

/** `skip`(值为 never)与 variant 字段都从结果里去掉 */
type KeyOf<S, K extends keyof S> = S[K] extends { [VARIANT_CASES]: any }
  ? never
  : InferType<S[K]> extends never
    ? never
    : K;

/**
 * 整个字段表 -> 解码结果类型。值为 `never`(skip)和 variant 的键会被去掉;
 * variant 的分支字段并进来(可选)。对已经是形状的类型幂等。
 */
export type InferDef<S> = S extends any
  ? Flatten<
      { [K in keyof S as KeyOf<S, K>]: InferType<S[K]> } & VariantExtras<S>
    >
  : never;

/** 整个字段表 -> encode 入参类型 */
export type InferEncodeDef<S> = S extends any
  ? Flatten<
      {
        [K in keyof S as KeyOf<S, K>]: InferEncode<S[K]>;
      } & VariantExtras<S>
    >
  : never;

/** 结构体来源的值类型(与 `InferType` 同义, 供 `records` 等签名用) */
export type InferSource<T> = InferType<T>;

// ------------------------------------------------------------ 标量

export interface StructBufferConfig {
  littleEndian?: boolean;
}

export interface ScalarCodec<D = number, E = D> extends Codec<D, E> {
  readonly size: number;
  readonly unsigned: boolean;
  readonly kind: TypeKind;
  readonly get: string;
  readonly set: string;
  decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): D;
  encode(
    value: E,
    littleEndian?: boolean,
    offset?: number,
    view?: DataView
  ): DataView;
}

/**
 * 注册一个标量类型。参数就是线上的字节形状, 没有类型名 —— 名字对编解码毫无用处。
 *
 * ```ts
 * const int = registerType(4, false);        // 4 字节有符号整数
 * const f32 = registerType(4, true, "float"); // 4 字节浮点
 * ```
 */
export function registerType(
  size: TypeSize_t,
  unsigned = true,
  kind: TypeKind = "int"
): ScalarCodec {
  const h = scalarHandle(size, unsigned, kind);
  const node: ScalarNode = {
    kind: "scalar",
    size,
    unsigned,
    typeKind: kind,
    get: h.get,
    set: h.set,
    isBig: h.isBig,
  };

  const codec = {
    node,
    size,
    unsigned,
    kind,
    get: h.get,
    set: h.set,
    decode(view: DecodeBuffer_t, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      return readNode(node, c, "value", littleEndian, {});
    },
    encode(value: any, littleEndian = false, offset = 0, view?: DataView) {
      const w = new Writer({ view, offset, littleEndian });
      writeNode(node, w, value, "value", littleEndian, {});
      return w.finish();
    },
  };
  return codec as unknown as ScalarCodec;
}

export const int8_t = registerType(1, false);
export const int16_t = registerType(2, false);
export const int32_t = registerType(4, false);
export const int64_t = registerType(8, false);
export const uint8_t = registerType(1, true);
export const uint16_t = registerType(2, true);
export const uint32_t = registerType(4, true);
export const uint64_t = registerType(8, true);
export const float = registerType(4, true, "float");
export const double = registerType(8, true, "float");

// ------------------------------------------------------------ 长度引用

export function ref(
  field: string,
  transform?: (val: number, ctx: AnyObject) => number
): Ref {
  return { __ref: true, field, transform };
}

export { isRef };
export type { Ref, Len };

// ------------------------------------------------------------ 字节 / 列表

/** 一段字节, 长度按字节数。`"rest"` 吃掉剩余全部 */
export function bytes(len: number | Ref | "rest"): Codec<Uint8Array, Uint8Array> {
  return make<Uint8Array, Uint8Array>({ kind: "bytes", len } as BytesNode);
}

/** `bytes("rest")` 的别名 */
export function rest(): Codec<Uint8Array, Uint8Array> {
  return bytes("rest");
}

/** 列表。嵌套用 `list(list(T, 2), 2)`, 不再有 `T[n]` 下标魔法 */
export function list<C extends Codec<any, any>>(
  item: C,
  len: number | Ref | "rest"
): Codec<InferType<C>[], InferEncode<C>[]> {
  return make<InferType<C>[], InferEncode<C>[]>({
    kind: "list",
    item: nodeOf(item),
    len,
  } as ListNode);
}

/**
 * 定长子记录一直填到末尾。子结构体含变长字段会在**构造期**报错, 而不是猜一个数。
 * 个数读到末尾才知道, 所以恒为数组。
 */
export function records<C extends Codec<any, any>>(
  source: C,
  len?: number | Ref
): Codec<InferType<C>[], InferEncode<C>[]> {
  const item = nodeOf(source);
  if (len === undefined && fixedSize(item) === undefined) {
    throw new TypeError(
      `records("${(item as StructNode).name ?? ""}"): 子结构体含变长字段, ` +
        `无法按定长填到末尾 —— 请显式给长度, 或改用 ref/framed`
    );
  }
  return make<InferType<C>[], InferEncode<C>[]>({
    kind: "list",
    item,
    len: len ?? "records",
  } as ListNode);
}

// ------------------------------------------------------------ 位域

function assertBitsStorage(size: number, kind: string): void {
  if (size !== 1 && size !== 2 && size !== 4) {
    throw new TypeError(
      `${kind}: 只支持 1/2/4 字节的存储(位运算走 JS 32 位整数), 实际 ${size}`
    );
  }
}

/** 位序号: 每一位 0/1。`{ a: 0, b: 2 }` */
export function bits(
  storage: ScalarCodec,
  positions: { [k: string]: number }
): Codec<{ [x: string]: Bit_t }, Partial<{ [x: string]: Bit_t }>> {
  const size = storage.size;
  assertBitsStorage(size, "bits");
  for (const [k, i] of Object.entries(positions)) {
    if (!Number.isInteger(i) || i < 0 || i >= size * 8) {
      throw new TypeError(
        `bits: 位 "${k}" 的下标 ${i} 越界, 应在 0..${size * 8 - 1}`
      );
    }
  }
  const h = scalarHandle(size, true, "int");
  return make<{ [x: string]: Bit_t }, Partial<{ [x: string]: Bit_t }>>({
    kind: "bits",
    size,
    ...h,
    positions,
  } as BitsNode);
}

/** 位宽: 值域 0..2^width-1。`{ a: 1, b: 2, c: 3 }` */
export function bitFields(
  storage: ScalarCodec,
  widths: { [k: string]: number }
): Codec<{ [x: string]: number }, Partial<{ [x: string]: number }>> {
  const size = storage.size;
  assertBitsStorage(size, "bitFields");
  let total = 0;
  for (const [k, len] of Object.entries(widths)) {
    if (!Number.isInteger(len) || len < 1) {
      throw new TypeError(`bitFields: 字段 "${k}" 的位宽 ${len} 非法, 应为正整数`);
    }
    total += len;
    if (total > size * 8) {
      throw new TypeError(
        `bitFields: 位宽总和 ${total} 超过 ${size * 8} 位(字段 "${k}" 越界)`
      );
    }
  }
  const h = scalarHandle(size, true, "int");
  return make<{ [x: string]: number }, Partial<{ [x: string]: number }>>({
    kind: "bitFields",
    size,
    ...h,
    widths,
  } as BitFieldsNode);
}

// ------------------------------------------------------------ skip

/** 占住 n 个字节, 结果里没有这个字段 */
export function skip(n: number): Codec<never, never> {
  return make<never, never>({ kind: "skip", n } as SkipNode);
}

// ------------------------------------------------------------ struct

export type StructDef = { [k: string]: Codec<any, any> };

export interface StructCodec<S extends StructDef>
  extends Codec<InferDef<S>, Partial<InferEncodeDef<S>>> {
  readonly name: string;
  readonly struct: S;
  decode(
    view: DecodeBuffer_t,
    littleEndian?: boolean,
    offset?: number
  ): InferDef<S>;
  decodeLenient(
    view: DecodeBuffer_t,
    littleEndian?: boolean,
    offset?: number
  ): LenientResult<InferDef<S>>;
  encode(
    obj: Partial<InferEncodeDef<S>>,
    littleEndian?: boolean,
    offset?: number,
    view?: DataView
  ): DataView;
}

function compileFields<S extends StructDef>(def: S): FieldNode[] {
  return Object.entries(def).map(([name, codec]) => ({
    name,
    node: nodeOf(codec as Codec<any, any>),
  }));
}

/**
 * 定义一个结构体. `def` 的键就是字段名与布局顺序; `littleEndian` 省略则继承父级
 * (逐级链式, 最近的显式配置赢)。
 */
export function struct<S extends StructDef>(
  name: string,
  def: S,
  config?: StructBufferConfig
): StructCodec<S> {
  const node: StructNode = {
    kind: "struct",
    name,
    fields: compileFields(def),
    le: config?.littleEndian,
  };

  const codec = {
    node,
    name,
    struct: def,
    decode(view: DecodeBuffer_t, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset, undefined, name);
      return decodeStruct(node, c, undefined, littleEndian);
    },
    decodeLenient(view: DecodeBuffer_t, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset, undefined, name);
      const sink: ErrorSink = { errors: [], stopped: false };
      const value = decodeStruct(node, c, sink, littleEndian);
      return { value, errors: sink.errors, consumed: c.pos - offset };
    },
    encode(
      obj: any,
      littleEndian = false,
      offset = 0,
      view?: DataView
    ) {
      const w = new Writer({
        view,
        offset,
        littleEndian: config?.littleEndian ?? littleEndian,
      });
      writeStruct(node, w, obj, littleEndian);
      return w.finish();
    },
  };
  return codec as unknown as StructCodec<S>;
}

// ------------------------------------------------------------ variant

export interface VariantCodec<C extends { [k: string]: StructDef }>
  extends Codec<any, any> {
  readonly [VARIANT_CASES]: C;
}

function compileVariantCases<C extends { [k: string]: StructDef }>(
  cases: C
): { [k: string]: FieldNode[] } {
  const out: { [k: string]: FieldNode[] } = {};
  for (const [k, def] of Object.entries(cases)) {
    out[k] = compileFields(def);
  }
  return out;
}

/**
 * 变体联合。判别字段必须声明在**本字段之前**(同层), 分支字段与判别字段**平级**。
 */
export function variant<C extends { [k: string]: StructDef }>(
  keyField: string,
  cases: C,
  opts?: { select?: (tag: any) => string | undefined }
): VariantCodec<C> {
  const node: VariantNode = {
    kind: "variant",
    keyField,
    cases: compileVariantCases(cases),
    select: opts?.select,
  };
  return make<any, any>(node) as VariantCodec<C>;
}

// ------------------------------------------------------------ 自定义 codec

export interface CodecSpec<T> {
  /** 定长字段给出宽度; 变长字段省略 */
  fixedSize?: number;
  /** 读一个字段; 返回 `null` 表示流结束(`framed`) */
  read: (c: Cursor, name: string) => T | null;
  write: (w: Writer, value: T, name: string) => void;
}

function toCodecNode<T>(spec: CodecSpec<T>, single: boolean): CodecNode {
  return {
    kind: "codec",
    fixedSize: spec.fixedSize,
    single,
    read: spec.read,
    write: spec.write,
  };
}

/**
 * 自定义字段. reader/writer 直接操作 `Cursor`/`Writer`, 尺寸由 reader 推进决定,
 * 所以 NUL 结尾的 C 字符串这类"长度只能跑起来才知道"的字段是自然的。
 */
export function codec<T>(spec: CodecSpec<T>): Codec<T> {
  return make<T, T>(toCodecNode(spec, false));
}

/**
 * 单个自定界字段: 读**一个**子帧, 游标停在它后面。reader 返回 `null` 视为字段不完整
 * (与 `framed` 的"流结束"不同)。
 */
export function delimited<T>(spec: CodecSpec<T>): Codec<T> {
  return make<T, T>(toCodecNode(spec, true));
}

/** 自定界子帧循环: 反复读一个自带长度的子帧直到字节耗尽 */
export function framed<T>(spec: CodecSpec<T>): Codec<T[]> {
  return make<T[], T[]>({
    kind: "list",
    item: toCodecNode(spec, false),
    len: "rest",
  } as ListNode);
}

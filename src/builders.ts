import {
  BlobField,
  CountSpec,
  Def,
  Field,
  FieldBuildCtx,
  FieldSpec,
  FramedField,
  FrameReader,
  FrameWriter,
  normalizeDef,
  SkipField,
  StructField,
  StructSource,
  VariantField,
} from "./field";
// VARIANT_CASES 是 `declare const`(运行时不存在), 必须按类型导入
import type { VARIANT_CASES } from "./class-type";
import { InferSource } from "./infer";

/**
 * 声明式字段工厂. 之所以做成"延迟构建"而不是直接造 Field: `littleEndian` 与
 * textCodec 要等父级 def 归一化时才知道, 由 makeField 统一注入才不会漏.
 *
 * 字段名一律取**对象的键**, 工厂自己不接受 name —— 两处都写名字就一定会有一处
 * 是错的, 而错的那处只会表现为"字段值莫名丢失", 极难查.
 *
 * `T`/`E` 是这个字段的解码值类型与 encode 入参类型, 只走类型推导(两个 phantom
 * 属性), 运行时都不携带 —— 声明式字段本身没有类型信息, 类型必须由工厂自己声明.
 * 两者分开是因为它们**确实不一样**: `rest()` 解出来是 `Uint8Array`, 但写回去时
 * 接受字节数组.
 */
export function field<T = any, E = T>(
  build: (b: FieldBuildCtx) => Field
): FieldSpec<T, E> {
  return { __fieldSpec: true, build } as FieldSpec<T, E>;
}

/**
 * 跳过 n 个字节, 结果里**不会有这个字段**(`InferDef` 把值为 `never` 的键整个去掉).
 *
 * 用来表达协议表里的"未知/保留/填充"字段: 位置必须占住, 但它不是数据.
 *
 * ```ts
 * // body[0] 未知, body[1..2]=sel, body[3..5] 未知
 * { _0: skip(1), sel: uint16_t, _1: skip(3) }
 * ```
 *
 * encode 时这 n 字节写 0.
 */
export function skip(n: number): FieldSpec<never, never> {
  return field((b) => new SkipField(b.name, n));
}

/**
 * `blob(ref("len"))` / `blob(16)` / `rest()`.
 *
 * 长度一律是**字节数**, 不是字符数: `"世界"` 的 length 是 2, UTF-8 编码占 6 字节,
 * GBK 占 4 字节 —— 拿字符数当长度头会把正文截掉.
 *
 * 文本字段也走这里, 编码由调用方自己接 `new TextDecoder(...)`。本库一行编解码都没实现,
 * `TextDecoder`/`TextEncoder` 全程委托平台, 所以不猜编码。
 *
 * ```ts
 * { head: uint8_t, payload: blob(ref("len")) }
 * ```
 */
/**
 * encode 入参额外收 `string`, 但**只按 UTF-8 编码** —— 非 UTF-8(GBK / UTF-16LE / ...)
 * 的正文自己编码好再传 `Uint8Array`。Node 的 `TextEncoder` 按规范只支持 UTF-8,
 * 别的编码得靠 iconv-lite 之类, 所以这一层不给编码参数。
 */
export type BlobValue = Uint8Array | number[] | string;

export function blob(spec: CountSpec): FieldSpec<Uint8Array, BlobValue> {
  return field((b) => new BlobField(b.name, spec));
}

/**
 * 吃掉"剩下的全部字节"。声明式长度前缀的终点标记 —— 报文尾部那段没有长度头可
 * 引用的变长正文靠它收尾。
 *
 * ```ts
 * { text_len: uint16_t, text: blob(ref("text_len")), tail: rest() }
 * ```
 */
export function rest(): FieldSpec<Uint8Array, BlobValue> {
  return field((b) => new BlobField(b.name, { until: "end" }));
}

/**
 * 定长子记录一直填到末尾。`stride` 默认取子结构体自身的定长字节数, 所以只有
 * 真正定长的子结构体用得起来 —— 变长的会在**构造期**直接报错, 而不是猜一个数。
 *
 * 个数是读到末尾才知道的, 所以解出来恒为数组(不像 `Nested[2]` 那样能还原成单值)。
 *
 * ```ts
 * { ents: records(Ent) }
 * ```
 */
export function records<S extends StructSource>(
  source: S,
  spec?: CountSpec
): FieldSpec<InferSource<S>[]> {
  return field((b) => {
    const def = normalizeDef(source, `${b.parentName}.${b.name}`, b.le);
    if (spec !== undefined) return new StructField(b.name, def, spec, []);
    if (def.fixedSize === undefined) {
      throw new TypeError(
        `records("${b.name}"): 子结构体 "${def.name}" 含变长字段, 无法按定长填到末尾` +
          ` —— 请显式给 spec(长度前缀), 或改用 ref/framed`
      );
    }
    return new StructField(b.name, def, { stride: def.fixedSize }, [], true);
  });
}

/**
 * 变体联合。判别字段 `keyField` 必须声明在**本字段之前**(同层), 分支字段与判别
 * 字段**平级** —— 和 C 的 union 写法一致, 也正好对上"一个类型字段 + 按类型展开
 * 载荷"这种常见报文。
 *
 * ```ts
 * { msg_type: uint8_t, body: variant("msg_type", {
 *     1: { name: blob(8) },
 *     2: { x: uint32_t, y: uint32_t },
 *   }) }
 * ```
 *
 * `select` 用于判别值不逐个枚举的场合:
 * ```ts
 * variant("op", cases, { select: (op) => ((op & 0x7f) === 1 ? "a" : "b") })
 * ```
 */
export function variant<C extends { [key: string]: StructSource }>(
  keyField: string,
  cases: C,
  opts?: { select?: (tag: any) => string | undefined }
): VariantSpec<C> {
  return field((b) => {
    const defs: { [k: string]: Def } = {};
    for (const [k, src] of Object.entries(cases)) {
      defs[k] = normalizeDef(src, `${b.parentName}.${b.name}.${k}`, b.le);
    }
    return new VariantField(b.name, keyField, defs, opts?.select);
  }) as VariantSpec<C>;
}

/**
 * variant 字段的静态形态: 值类型是 `any`(分支字段平铺进父对象, 自己这个键运行时
 * 根本不存在), 但带着分支表 `C` —— `InferDef` 靠它把各分支的字段并进父对象.
 */
export interface VariantSpec<C extends { [key: string]: StructSource }>
  extends FieldSpec<any> {
  readonly [VARIANT_CASES]: C;
}

/**
 * 判别联合, 直接铺进外层 def: 返回"判别字段 + variant 字段"这个对象, 用 `...`
 * 展开。判别字段因此排在 variant 之前, 满足 `variant` 的前置要求。
 *
 * ```ts
 * new DynamicStructBuffer("chat", {
 *   chan: uint8_t,
 *   ...discriminated("body", "msg_type", uint8_t, {
 *     0x0a: { len: uint16_t, text: blob(ref("len")) },
 *     0x0b: { id: uint32_t },
 *   }),
 * })
 * ```
 */
export function discriminated(
  name: string,
  keyField: string,
  keyType: any,
  cases: { [key: string]: StructSource }
): { [k: string]: any } {
  return {
    [keyField]: keyType,
    [name]: variant(keyField, cases),
  };
}

/**
 * 自定界子帧循环: 反复读一个自带长度的子帧直到字节耗尽。
 *
 * `op|flen|body` 这种流式布局没法用长度前缀声明 —— 与其做一个猜错一半的 DSL,
 * 不如老实让调用方描述"怎么跳过一个子帧"。子帧内部用 `c.region(n, ...)` 划
 * 窗口, 于是帧尾残余字节不会漏进父结构。
 *
 * ```ts
 * ops: framed(
 *   {
 *     read: (c) => {
 *       const op = c.u8("op");
 *       const n = c.u8("flen");
 *       return { op, body: c.bytes(n, "body") };
 *     },
 *   },
 *   {
 *     write: (w, v) => {
 *       w.u8(v.op);
 *       w.u8(v.body.length);
 *       w.bytes(v.body);
 *     },
 *   }
 * )
 * ```
 *
 * 注意它**贪婪读到缓冲区末尾**, 所以**只能放在结构体最后一个字段** —— 后面还有字段
 * 时它会把那些字节也当成下一个子帧吃掉(而且失败时已经吃掉了, 后面字段直接报越界)。
 * 变长字段夹在中间请用 `delimited`.
 */
export function framed<T>(
  reader: FrameReader<T>,
  writer: FrameWriter<T>
): FieldSpec<T[]> {
  return field((b) => new FramedField<T>(b.name, reader, writer));
}

/**
 * 单个自定界字段: 读**一个**子帧, 然后把游标停在它后面, 后续字段继续。
 *
 * 与 `framed` 只差"读几个": framed 是流式布局(读到字节耗尽), 变长字段夹在结构体
 * 中间时它会把后面字段的字节也当成下一个子帧吃掉。尺寸完全由 reader 推进
 * `Cursor` 决定 —— 引擎不需要提前知道, 所以 NUL 结尾的 C 字符串这类"长度只能
 * 跑起来才知道"的字段在这里是自然的.
 *
 * ```ts
 * // NUL 结尾的 C 字符串
 * const cstr = () =>
 *   delimited<string>(
 *     {
 *       read: (c) => {
 *         const at = c.pos;
 *         while (c.left > 0) {
 *           if (c.view.getUint8(c.pos++) === 0) {
 *             // 已经扫过整段正文, 直接从 view 取: bytes() 只能从当前位置读,
 *             // 而游标此刻已经停在结尾 NUL 之后了
 *             const n = c.pos - at - 1;
 *             const view = new Uint8Array(
 *               c.view.buffer,
 *               c.view.byteOffset + at,
 *               n
 *             );
 *             return new TextDecoder().decode(view);
 *           }
 *         }
 *         throw DecodeError.reason(c.where, at, "没遇到结尾 NUL");
 *       },
 *     },
 *     {
 *       write: (w, v) => {
 *         w.bytes(new TextEncoder().encode(v));
 *         w.u8(0);
 *       },
 *     }
 *   );
 * ```
 */
export function delimited<T>(
  reader: FrameReader<T>,
  writer: FrameWriter<T>
): FieldSpec<T> {
  return field((b) => new FramedField<T>(b.name, reader, writer, true));
}

export type {
  Field,
  FieldSpec,
  FieldBuildCtx,
  StructSource,
  CountSpec,
  FrameReader,
  FrameWriter,
  Def,
};

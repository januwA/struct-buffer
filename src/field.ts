import { StringType, StructType } from "./class-type";
// VALUE_TYPE/ENCODE_VALUE_TYPE 是 `declare const`(运行时不存在), 必须按类型导入,
// 否则打包器会把它们当真实导入留下, 运行时报"没有这个导出"
import type { ENCODE_VALUE_TYPE, VALUE_TYPE } from "./class-type";
import { Cursor } from "./cursor";
import { DecodeError, EncodeError } from "./errors";
import { AnyObject } from "./interfaces";
import { StructBuffer } from "./struct-buffer";
import { isRef, Ref, withCount } from "./utils";
import { Writer } from "./writer";

/** `ref` 往上找几层 */
export type Scope = "self" | "parent" | "root";

/** 取同层(默认)/上层字段的值作为个数; `transform` 再过一道 */
export interface RefSpec {
  field: string;
  scope?: Scope;
  transform?: (val: number, ctx: AnyObject) => number;
}

/**
 * 元素个数/字节数的描述.
 *
 * - 数字: 常量
 * - `{field}`: 引用另一个字段(见 `ref()`)
 * - `{product}`: 多层 deeps 里同时含常量与 ref 时的乘积(如 `It[2][ref("n")]`)
 * - `{until:"end"}`: 吃掉"剩下的全部字节" —— `rest`
 * - `{stride}`: 剩余字节数 / 单元尺寸 —— 定长子记录填满到末尾
 */
export type CountSpec =
  | number
  | RefSpec
  | { product: CountSpec[] }
  | { until: "end" }
  | { stride: number };

export function isRefSpec(spec: CountSpec): spec is RefSpec {
  return typeof spec === "object" && "field" in spec;
}

/** 一次长度解析发生的地点, 报错时要说人话 */
export interface Site {
  where: string;
  field: string;
  offset: number;
}

/**
 * 取值上下文. 每个元素一个实例, 于是 `ref` 天然只能看到"同层已解析的字段" ——
 * **声明顺序即依赖**. 这跟真实协议的布局一致, 也让"长度字段声明在被它长度化的
 * 数据之后"这种写法变成一件会**报错**的事, 而不是一件静默产出垃圾的事
 * (旧实现里 `data: uint8_t[ref("len")], len: uint8_t` encode 出 1 字节 0,
 *  decode 出 `{data: [], len: 1}`).
 */
export class Ctx {
  constructor(
    readonly values: AnyObject,
    readonly parent: Ctx | undefined,
    /** 本元素在本层的下标, 供嵌套形状还原 */
    readonly index: number = 0
  ) {}

  child(values: AnyObject, index = 0): Ctx {
    return new Ctx(values, this, index);
  }

  get root(): Ctx {
    let c: Ctx = this;
    while (c.parent) c = c.parent;
    return c;
  }

  /** 兼容 `StructType.getCount(ctx)`: 那套 API 收的是 values 对象而不是 Ctx */
  get valuesFor(): AnyObject {
    return this.values;
  }

  /** 支持 `a.b.c` 下钻; 起点由 scope 决定 */
  lookup(path: string, scope: Scope = "self"): any {
    let cur: any =
      scope === "self"
        ? this.values
        : scope === "parent"
          ? this.parent?.values
          : this.root.values;
    for (const seg of path.split(".")) {
      if (cur == null) return undefined;
      cur = cur[seg];
    }
    return cur;
  }
}

export function resolveCount(
  spec: CountSpec,
  ctx: Ctx,
  left: number,
  site: Site
): number {
  if (typeof spec === "number") return spec;
  if ("until" in spec) return left;
  if ("stride" in spec) {
    if (spec.stride <= 0)
      throw new EncodeError(site.where, `${site.field}: stride 必须 > 0`);
    return Math.floor(left / spec.stride);
  }
  if ("product" in spec) {
    return (spec.product as CountSpec[]).reduce<number>(
      (a, sub) => a * resolveCount(sub, ctx, left, site),
      1
    );
  }

  const raw = ctx.lookup(spec.field, spec.scope ?? "self");
  if (raw == null) {
    throw DecodeError.reason(
      site.where,
      site.offset,
      `${site.field}: ref("${spec.field}") 指向的字段尚未解析 —— ` +
        `ref 只能引用同一层里声明在它之前的字段` +
        (spec.scope && spec.scope !== "self" ? ` (scope=${spec.scope})` : "")
    );
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw DecodeError.reason(
      site.where,
      site.offset,
      `${site.field}: ref("${spec.field}") 取到 ${JSON.stringify(
        raw
      )}, 不是有限数字`
    );
  }
  const n = spec.transform ? spec.transform(raw, ctx.valuesFor) : raw;
  if (!Number.isFinite(n) || n < 0) {
    throw DecodeError.reason(
      site.where,
      site.offset,
      `${site.field}: ref("${spec.field}")${
        spec.transform ? " 的 transform 之后" : ""
      }得到 ${n}, 不是非负整数`
    );
  }
  return n;
}

export function specText(spec: CountSpec): string {
  if (typeof spec === "number") return String(spec);
  if ("field" in spec) return `ref("${spec.field}")`;
  if ("until" in spec) return "until:end";
  if ("stride" in spec) return `stride:${spec.stride}`;
  return `product(${spec.product.map(specText).join(" * ")})`;
}

/**
 * 字段. 覆盖实际会用到的全部报文形状: 标量 / 字节段 / 嵌套结构体 / 变体联合 /
 * 自定界子帧.
 *
 * 每个字段只管自己那一段, 位置存在 Cursor/Writer 里, 因此嵌套任意深都是一次线性
 * 扫描 —— 旧实现"外层循环 + 内部整段 decode"造成的 N² 与偏移漂移从结构上消失.
 */
export interface Field {
  readonly name: string;
  /** 定长字段的单实例字节数; 变长字段为 undefined */
  readonly fixedSize?: number;

  /**
   * 回填长度字段, 返回新对象; 无可回填时**原样返回**, 零分配.
   * 绝不改传入的对象 —— 旧实现的 `prepItem` 会直接把调用方的 `msg_size` 写掉.
   */
  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
  encode(w: Writer, value: any, ctx: Ctx): void;
}

/**
 * 宽松解码的失败收集器. `stopped` 表示"当前位置已经不可信" —— 一旦置位, 上层循环
 * 也必须停: 再往下猜位置只会产出垃圾.
 */
export interface ErrorSink {
  errors: DecodeError[];
  stopped: boolean;
}

/**
 * 逐字段解码的唯一实现. 严格解码就是 `sink` 为空的情形, 所以两条路径不可能分叉。
 *
 * 失败后的恢复策略, 按可信度排序:
 *
 * - **定长字段**失败: 位置仍然精确. 照样跳过它的 `fixedSize` 字节并继续解析后面的
 *   字段 —— 抓包时一个字段坏了不该把整帧丢掉.
 * - **变长字段**失败: 长度字段被垃圾数据带偏, "下一个字段从哪开始"已经无从得知.
 *   位置不可信就只能停(`sink.stopped = true`), 本层剩余字段留 `undefined`; 嵌套
 *   结构体把同一个 sink 往下传, 于是 `stopped` 会逐层向上传播.
 *
 * 只捕获 `DecodeError`. 自定义 codec 抛的 `TypeError` 是 bug 而不是坏数据, 必须炸
 * 出来, 否则宽松解码会把它伪装成一条"数据有问题"。
 */
export function runFields(
  fields: Field[],
  c: Cursor,
  out: AnyObject,
  ctx: Ctx,
  sink?: ErrorSink
): void {
  for (const f of fields) {
    if (sink?.stopped) return;
    const start = c.pos;
    try {
      f.decode(c, out, ctx, sink);
    } catch (e) {
      if (!sink || !(e instanceof DecodeError)) throw e;
      sink.errors.push(e);
      out[f.name] = undefined;
      c.pos = start; // 半截的推进一律回滚
      const size = f.fixedSize;
      if (size === undefined || size > c.left) {
        sink.stopped = true;
        return;
      }
      c.pos = start + size;
    }
  }
}

/** 归一化后的结构体定义: 构造期算一次, 之后 decode/encode 只遍历它 */
export interface Def {
  name: string;
  fields: Field[];
  /** 深层的元素数; [] 表示标量 */
  shape: number[];
  le: boolean;
  /** 单实例定长字节数; 含变长字段则为 undefined */
  readonly fixedSize?: number;
}

function computeFixedSize(fields: Field[]): number | undefined {
  let total = 0;
  for (const f of fields) {
    if (f.fixedSize === undefined) return undefined;
    total += f.fixedSize;
  }
  return total;
}

/** 按形状把平铺的元素还原成多层数组; shape=[] 表示单个值 */
export function nest(values: any[], shape: number[]): any {
  if (shape.length === 0) return values[0];
  if (shape.length === 1) return shape[0] === 1 ? values[0] : values;
  const rest = shape.slice(1);
  const stride = rest.reduce((a, b) => a * b, 1);
  const out: any[] = [];
  for (let i = 0; i < shape[0]; i++) {
    out.push(nest(values.slice(i * stride, (i + 1) * stride), rest));
  }
  return out;
}

/** 把(可能多层的)值拍平成元素列表 */
export function flatten(value: any): any[] {
  if (value == null) return [];
  return Array.isArray(value) ? value.flat(Infinity) : [value];
}

function defFixedSize(def: Def, site: Site): number {
  if (def.fixedSize === undefined) {
    throw new EncodeError(
      site.where,
      `${site.field}: 子结构体 "${def.name}" 含变长字段, 无法按定长填充`
    );
  }
  return def.fixedSize;
}

/** 逐字段回填长度; 只在真的改动时重建对象 */
export function resolveLengths(
  def: Def,
  obj: AnyObject,
  parent?: Ctx
): AnyObject {
  let out = obj;
  let ctx = new Ctx(out, parent, 0);
  for (const f of def.fields) {
    const next = f.resolveLengths(out, ctx);
    if (next !== out) {
      out = next;
      // 值变了就重建 ctx, 让后面的字段能看到刚回填的长度
      ctx = new Ctx(out, parent, 0);
    }
  }
  return out;
}

// ---------------------------------------------------------------- TypeField

function shapeOf(deeps: (number | Ref)[] | undefined): number[] {
  return (deeps ?? []).map((d) => (isRef(d) ? -1 : Number(d)));
}

/**
 * 任意 `StructType`: `uint8_t` / `uint16_t` / `string_t` / `bits(...)` / 用户自定义
 * codec. 个数语义与旧实现完全一致: **ref 取到的就是元素个数**
 * (`uint8_t[ref("n")]` 的 n 是元素数; 对 u8 来说也就是字节数).
 *
 * 位置不再靠"返回值 + getByteLength 相加"推进, 而是 decode/encode 后按
 * `type.getSize(ctx)` 精确跳过 —— 全库只剩这一处尺寸计算, 而它与类型自己写出的
 * 字节数来自同一个 `size`/`count`, 结构上不可能再分叉.
 */
export class TypeField implements Field {
  readonly fixedSize?: number;
  private readonly spec: CountSpec;
  private readonly refSpec?: RefSpec;

  constructor(
    readonly name: string,
    private readonly le: boolean,
    private readonly type: StructType<any, any>,
    private readonly textDecode?: TextDecoder,
    private readonly textEncoder?: TextEncoder
  ) {
    const deeps = type.deeps ?? [];
    this.spec = countOfDeeps(deeps);
    const only = onlyRef(deeps);
    this.refSpec = only ? { field: only.field, transform: only.transform } : undefined;
    if (deeps.length === 0) {
      this.fixedSize = type.size;
    } else if (!deeps.some(isRef)) {
      this.fixedSize =
        deeps.reduce((a: number, d) => a * Number(d), 1) * type.size;
    }
    // 有 ref ⇒ 变长, 保持 undefined. 不能用 getCount() 判: 无 ctx 时 ref 解析成
    // 0, 会把变长字段误判成"定长 0 字节"(旧 `sizeof` 就是这么错的)
  }

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    const spec = this.refSpec;
    if (!spec || spec.transform) return obj;
    if (obj[spec.field] != null) return obj;
    if (obj[this.name] == null) return obj;
    return { ...obj, [spec.field]: flatten(obj[this.name]).length };
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    const site: Site = { where: c.where, field: this.name, offset: c.pos };
    const count = resolveCount(this.spec, ctx, c.left, site);
    const values = withCount(ctx.values, count);
    const size = this.type.getSize(values);
    c.need(size, this.name);
    const start = c.pos;
    out[this.name] = this.type.decode(
      c.view,
      this.le,
      start,
      this.textDecode,
      values
    );
    c.pos = start + size;
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    const site: Site = { where: "encode", field: this.name, offset: w.pos };
    const count = resolveCount(this.spec, ctx, Infinity, site);
    const values = withCount(ctx.values, count);
    const size = this.type.getSize(values);
    w.reserve(size);
    if (value == null && count > 0) {
      w.zero(size);
      return;
    }
    const before = w.raw;
    const after = this.type.encode(
      value,
      this.le,
      w.pos,
      before,
      this.textEncoder,
      values
    );
    if (after !== before) w.rebind(after);
    w.advance(size);
  }
}

// ---------------------------------------------------------------- SkipField

/**
 * 跳过 n 个字节, **不产生任何输出字段**.
 *
 * 与"把字节解成 uint8 数组"的写法相比, skip 的区别是"这里根本不是数据": 那条路会把
 * 跳过的字节塞进结果, 于是上报时得自己剔掉, 类型里也永远带着那几个键 —— 真实项目
 * 里协议表一半的字段是"未知/保留/填充", 让它们出现在结果里只会污染每一次消费.
 *
 * 值类型是 `never`, `InferDef` 据此把这个键从推导结果里整个去掉, 所以
 * `InferType` 出来就是干净的"真实字段"结构.
 */
export class SkipField implements Field {
  readonly fixedSize: number;

  constructor(
    readonly name: string,
    size: number
  ) {
    this.fixedSize = size;
  }

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    return obj;
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    c.skip(this.fixedSize, this.name);
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    w.zero(this.fixedSize); // 填充位写 0: 与 decode 侧的"跳过"对称
  }
}

// ---------------------------------------------------------------- BlobField

/**
 * 一段字节, 长度**一律按字节数**.
 *
 * `as:"text"` 走 textDecode/textEncoder, 于是
 * `{text_len: uint16_t, text: string_t[ref("text_len")]}` 配 `text: "世界"`
 * 写出 `len=6` 而不是 `s.length=2` —— 旧实现正是在这里把 UTF-8/GBK 正文截成
 * 2 字节, 而聊天正文恰恰是中文.
 *
 * `spec` 是数字(`string_t[8]`)时是**定宽**字段, 与旧 `string_t[n]` 同一套语义:
 * encode 写满 8 字节(短补 0 / 长截断), decode 在第一个 NUL 处截断. 不这么做的话
 * 短字符串会让后面所有字段整体错位, 而 NUL 补位也会混进字符串里.
 */
export class BlobField implements Field {
  readonly fixedSize?: number;

  constructor(
    readonly name: string,
    private readonly spec: CountSpec,
    private readonly as: "text" | "bytes",
    private readonly textDecoder?: TextDecoder,
    private readonly textEncoder?: TextEncoder
  ) {
    if (typeof spec === "number") this.fixedSize = spec;
  }

  private encodeValue(value: any): Uint8Array {
    const enc = this.textEncoder ?? new TextEncoder();
    if (value == null) return new Uint8Array(0);
    if (this.as === "text") {
      const items = flatten(value);
      if (items.length === 0) return new Uint8Array(0);
      const parts = items.map((v) => enc.encode(String(v)));
      const total = parts.reduce((a, p) => a + p.length, 0);
      const out = new Uint8Array(total);
      let o = 0;
      for (const p of parts) {
        out.set(p, o);
        o += p.length;
      }
      return out;
    }
    if (value instanceof Uint8Array) return value;
    if (Array.isArray(value)) return Uint8Array.from(value as number[]);
    if (typeof value === "string") return enc.encode(value);
    throw new EncodeError(
      "encode",
      `${this.name}: 期望 Uint8Array/number[]/string, 实际 ${typeof value}`
    );
  }

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    if (!isRefSpec(this.spec) || this.spec.transform) return obj;
    if (obj[this.spec.field] != null) return obj;
    if (obj[this.name] == null) return obj;
    return { ...obj, [this.spec.field]: this.encodeValue(obj[this.name]).length };
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    const site: Site = { where: c.where, field: this.name, offset: c.pos };
    const n = resolveCount(this.spec, ctx, c.left, site);
    const raw = c.bytes(n, this.name);
    if (this.as !== "text") {
      out[this.name] = raw.slice();
      return;
    }
    // 定宽文本: 第一个 NUL 之后是补位, 丢掉(旧 `string_t` 就是遇 0 截断).
    // NUL 是单字节且不可能出现在多字节序列中间, 所以切在它上面不会劈开 UTF-8.
    // 变长文本(ref/rest)按整段解 —— 那里 NUL 属于正文, 截掉等于悄悄丢数据.
    const nul = this.fixedSize === undefined ? -1 : raw.indexOf(0);
    const body = nul < 0 ? raw : raw.subarray(0, nul);
    out[this.name] = (this.textDecoder ?? new TextDecoder()).decode(body);
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    // 校验长度字段可解析(缺失/非法时给出指名道姓的错误); 实际写入以字节数为准
    resolveCount(this.spec, ctx, Infinity, {
      where: "encode",
      field: this.name,
      offset: w.pos,
    });
    const bytes = this.encodeValue(value);
    const size = this.fixedSize;
    if (size === undefined) {
      w.bytes(bytes);
      return;
    }
    // 定宽: 永远写满 size 字节(短补 0 / 长截断). 直接写 bytes 会让短字符串把
    // 后面所有字段前移, 而 sizeof() 报的仍是 size —— 错位要到对端才暴露.
    const out = new Uint8Array(size);
    out.set(bytes.subarray(0, size));
    w.bytes(out);
  }
}

// -------------------------------------------------------------- StructField

/**
 * 嵌套结构体, 来源可以是 `StructBuffer` / `DynamicStructBuffer` / 内联对象字面量.
 * 归一化成 `Def` 后与父级**共用同一个 Cursor**, 所以任意深度都只有一次线性扫描.
 */
export class StructField implements Field {
  readonly fixedSize?: number;

  constructor(
    readonly name: string,
    private readonly def: Def,
    private readonly spec: CountSpec,
    private readonly shape: number[],
    /**
     * 一直填到末尾(`records`): decode 时个数由"剩余字节 / 单元尺寸"算出, encode
     * 时个数只能取自值数组本身 —— 数据里没有长度头可读, 也就无从校验.
     */
    private readonly toEnd: boolean = false
  ) {
    if (typeof spec === "number" && def.fixedSize !== undefined) {
      this.fixedSize = def.fixedSize * spec;
    }
  }

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    let out = obj;
    if (
      isRefSpec(this.spec) &&
      !this.spec.transform &&
      out[this.spec.field] == null &&
      out[this.name] != null
    ) {
      out = { ...out, [this.spec.field]: flatten(out[this.name]).length };
    }
    if (out[this.name] == null) return out;

    const items = flatten(out[this.name]);
    let changed = false;
    const resolved = items.map((item) => {
      if (item == null) return item;
      const r = resolveLengths(this.def, item, ctx);
      if (r !== item) changed = true;
      return r;
    });
    if (!changed) return out;
    return {
      ...out,
      [this.name]:
        this.shape.length === 0
          ? resolved[0]
          : nest(resolved, this.shape),
    };
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    const site: Site = { where: c.where, field: this.name, offset: c.pos };
    const n = resolveCount(this.spec, ctx, c.left, site);
    const values: any[] = [];
    // 同一个位置, 换个更深的定位标签: 位置是共享的, 但子结构体里的报错要能说出
    // `Outer.inner.y` 而不是 `Outer.y`
    const ic = c.sub(this.name);
    for (let i = 0; i < n; i++) {
      // 位置已不可信 ⇒ 剩下的元素无从解析, 硬解只会凭空造出垃圾元素
      if (sink?.stopped) break;
      const item: AnyObject = {};
      runFields(this.def.fields, ic, item, ctx.child(item, i), sink);
      // 当前元素已解出的字段仍然有效, 保留(哪怕它后面的字段失败了)
      values.push(item);
    }
    // toEnd 的个数是"读到末尾才知道几个", 不可能还原成单值/多维形状, 只能是数组
    out[this.name] = this.toEnd ? values : nest(values, this.shape);
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    const site: Site = { where: "encode", field: this.name, offset: w.pos };
    const n = this.toEnd ? flatten(value).length : resolveCount(this.spec, ctx, Infinity, site);
    const items = flatten(value);

    if (items.length === 0 && value == null) {
      w.zero(defFixedSize(this.def, site) * n);
      return;
    }
    if (items.length < n) {
      throw new EncodeError(
        "encode",
        `${this.name}: 需要 ${n} 个元素(${specText(this.spec)}), 实际给了 ${items.length}`
      );
    }
    for (let i = 0; i < n; i++) {
      const item = items[i];
      if (item == null) {
        w.zero(defFixedSize(this.def, site));
        continue;
      }
      const cctx = ctx.child(item, i);
      for (const f of this.def.fields) f.encode(w, item[f.name], cctx);
    }
  }
}

// ------------------------------------------------------------- VariantField

/**
 * 变体联合. 判别字段必须是**同层里声明在本字段之前**的字段 —— 这样两个方向都
 * 无歧义, 也正好对上"一个类型字段 + 按类型平铺展开载荷"这种常见报文.
 *
 * 分支字段与判别字段**平级**(和 C 的 union 写法一致), 所以 `encode` 时 `value`
 * 恒为 undefined, 数据全在 `ctx.values` 上.
 */
export class VariantField implements Field {
  readonly fixedSize = undefined;

  constructor(
    readonly name: string,
    private readonly keyField: string,
    private readonly cases: { [key: string]: Def },
    private readonly select?: (tag: any) => string | undefined
  ) {}

  private pick(out: AnyObject, site: Site): Def {
    const tag = out[this.keyField];
    const key =
      tag == null ? undefined : this.select ? this.select(tag) : String(tag);
    const def = key == null ? undefined : this.cases[key];
    if (!def) {
      throw DecodeError.reason(
        site.where,
        site.offset,
        `${this.name}: ${this.keyField}=${JSON.stringify(tag)} 没有对应分支 (已有: ${
          Object.keys(this.cases).join(", ") || "无"
        })`
      );
    }
    return def;
  }

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    return resolveLengths(this.pick(obj, { where: "encode", field: this.name, offset: 0 }), obj, ctx);
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    const def = this.pick(out, {
      where: c.where,
      field: this.name,
      offset: c.pos,
    });
    runFields(def.fields, c, out, ctx, sink);
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    void value; // 分支字段都在 ctx.values 上, 没有"这个字段的值"可言
    const def = this.pick(ctx.values, {
      where: "encode",
      field: this.name,
      offset: w.pos,
    });
    for (const f of def.fields) f.encode(w, ctx.values[f.name], ctx);
  }
}

// -------------------------------------------------------------- FramedField

export interface FrameReader<T = any> {
  /**
   * 读一个子帧; 返回 `null` 表示流结束(例如剩余字节不够一个子帧头).
   * 必须让 c 前进 —— 一次都不动会被当成"死循环"直接报错.
   *
   * 类型是 `T | null` 而不是 `T`: 不返回 null 就没法在帧尾干净地收手, 而假装
   * 调用方不可能返回 null 等于逼着类型断言.
   */
  read(c: Cursor, index: number): T | null;
}

export interface FrameWriter<T = any> {
  write(w: Writer, value: T, index: number): void;
}

/**
 * 自定界子帧循环: 反复读一个自带长度的子帧直到剩余字节耗尽.
 * `op|flen|body` 这种流式布局没法用长度前缀声明 —— 与其做一个猜错一半的 DSL,
 * 不如老实让调用方描述"怎么跳过一个子帧". 子帧内部用 `c.region(n, ...)` 划窗口,
 * 于是帧尾残余字节不会漏进父结构.
 */
export class FramedField<T = any> implements Field {
  readonly fixedSize = undefined;

  constructor(
    readonly name: string,
    private readonly reader: FrameReader<T>,
    private readonly writer: FrameWriter<T>
  ) {}

  resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject {
    return obj; // 子帧自己的长度只能靠 encode 量出来, 声明期无从回填
  }

  decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void {
    const values: any[] = [];
    while (c.left > 0) {
      if (sink?.stopped) break;
      const before = c.pos;
      const value = this.reader.read(c, values.length);
      if (value == null) break;
      if (c.pos === before) {
        throw DecodeError.reason(
          c.where,
          before,
          `${this.name}: 第 ${values.length} 个子帧没有消费任何字节, 会死循环`
        );
      }
      values.push(value);
    }
    out[this.name] = values;
  }

  encode(w: Writer, value: any, ctx: Ctx): void {
    const items = flatten(value);
    for (let i = 0; i < items.length; i++) this.writer.write(w, items[i], i);
  }
}

// ------------------------------------------------------------------ 归一化

export type InlineDef = { [k: string]: any };
export type StructSource = StructBuffer | Def | InlineDef;

export function isDef(x: any): x is Def {
  return !!x && Array.isArray(x.fields);
}

/** `DynamicStructBuffer` 之类"自带已归一化 def"的结构体 */
function isDefSource(x: any): boolean {
  return !!x && !isDef(x) && isDef(x.def);
}

/** deeps 里唯一的 ref; 没有或多个都返回 undefined */
function onlyRef(deeps: (number | Ref)[] | undefined): Ref | undefined {
  if (!deeps || deeps.length !== 1) return undefined;
  const d = deeps[0];
  return isRef(d) ? d : undefined;
}

function countOfDeeps(deeps: (number | Ref)[]): CountSpec {
  if (deeps.length === 0) return 1;
  const only = onlyRef(deeps);
  if (only) return { field: only.field, transform: only.transform };
  if (!deeps.some(isRef)) {
    return deeps.reduce((a: number, d) => a * Number(d), 1);
  }
  return {
    product: deeps.map(
      (d) =>
        (isRef(d) ? { field: d.field, transform: d.transform } : Number(d)) as CountSpec
    ),
  };
}

/** 构建 Field 时能拿到的上下文(字节序/编解码器在归一化时就定型) */
export interface FieldBuildCtx {
  name: string;
  parentName: string;
  le: boolean;
  textDecode?: TextDecoder;
  textEncoder?: TextEncoder;
}

/**
 * 声明式字段工厂. 之所以做成"延迟构建"而不是直接造 Field: `littleEndian` 与
 * textCodec 要等父级 def 归一化时才知道, 由 makeField 统一注入才不会漏。
 */
export interface FieldSpec<T = any, E = T> {
  readonly __fieldSpec: true;
  /**
   * phantom: 声明"我这个字段解码出来是 T", 运行时**不存在**这个属性.
   * 与 `StructType[VALUE_TYPE]` 同一个机制(`blob()` 靠它把 `Uint8Array` 带进
   * `InferType`) —— 声明式字段的运行时形态只有 `{build}`, 类型只能由工厂自己声明.
   */
  readonly [VALUE_TYPE]: T;
  /**
   * phantom: encode 时这个字段收什么. 解码值和 encode 入参**不是一回事** ——
   * `rest()`/`blob()` 解出来是 `Uint8Array`, 写回去却接受字节数组, 合成一个类型
   * 就得把 `Uint8Array` 放宽成 `Uint8Array | number[]`, 而那会让 `d.body.length`
   * 这类正常用法也要多一次收窄.
   */
  readonly [ENCODE_VALUE_TYPE]: E;
  build(ctx: FieldBuildCtx): Field;
}

export function isFieldSpec(x: any): x is FieldSpec {
  return !!x && x.__fieldSpec === true;
}

/**
 * 把任意一种结构体来源归一化成 `Def`, 只在构造期跑一次.
 *
 * `StructBuffer` 会被展开成 `Field[]`, 顺带修掉一个旧 bug: 旧实现对嵌套
 * `StructBuffer` 一律透传**父级**字节序, 子结构体自己的 `config.littleEndian`
 * 只有在特定路径下才生效; 现在子结构体一定赢。
 *
 * 代价: 构造后再改 `sb.struct` 不会反映到已归一化的 def 里(旧实现会)。
 * 换来的是 decode 路径上零属性查找。
 */
export function normalizeDef(
  source: StructSource,
  name: string,
  inheritedLE: boolean,
  codecs?: { textDecode?: TextDecoder; textEncoder?: TextEncoder }
): Def {
  if (isDef(source)) return source;
  if (isDefSource(source)) return (source as any).def;
  if (source instanceof StructBuffer) {
    const le = source.config.littleEndian ?? inheritedLE;
    return buildDef(
      source.struct,
      name,
      le,
      source.config.textDecode ?? codecs?.textDecode,
      source.config.textEncoder ?? codecs?.textEncoder
    );
  }
  return buildDef(source, name, inheritedLE, codecs?.textDecode, codecs?.textEncoder);
}

function buildDef(
  struct: InlineDef,
  name: string,
  le: boolean,
  textDecode?: TextDecoder,
  textEncoder?: TextEncoder
): Def {
  const fields = Object.entries(struct).map(([key, type]) =>
    makeField(
      key,
      type,
      { name: key, parentName: name, le, textDecode, textEncoder }
    )
  );
  return { name, fields, shape: [], le, fixedSize: computeFixedSize(fields) };
}

function makeField(key: string, type: any, bctx: FieldBuildCtx): Field {
  if (isFieldSpec(type)) return type.build({ ...bctx, name: key });

  if (type instanceof StructBuffer || isDef(type) || isDefSource(type)) {
    const def = normalizeDef(type, `${bctx.parentName}.${key}`, bctx.le, bctx);
    const deeps = (type as StructBuffer).deeps ?? [];
    return new StructField(key, def, countOfDeeps(deeps), shapeOf(deeps));
  }

  // 内联对象字面量 = 嵌套结构体(变体分支、匿名子结构)
  if (type && typeof type === "object" && !(type instanceof StructType)) {
    const def = normalizeDef(type, `${bctx.parentName}.${key}`, bctx.le, bctx);
    return new StructField(key, def, 1, []);
  }

  if (type instanceof StringType) {
    // 字符串的长度语义是**字节数**, 不能和 uint16_t 共用"元素个数"那套:
    // `"世界".length` 是 2, UTF-8 编码是 6, GBK 又是 4. 旧实现取 s.length,
    // 于是中文正文被截成 2 字节, 且长度头写的是 2.
    return new BlobField(
      key,
      countOfDeeps(type.deeps ?? []),
      "text",
      bctx.textDecode,
      bctx.textEncoder
    );
  }
  if (type instanceof StructType) {
    return new TypeField(
      key,
      bctx.le,
      type,
      bctx.textDecode,
      bctx.textEncoder
    );
  }

  throw new TypeError(
    `DynamicStructBuffer: 字段 "${key}" 收到无法识别的类型 ${typeof type}`
  );
}

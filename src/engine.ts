import { Cursor } from "./cursor";
import { DecodeError, EncodeError } from "./errors";
import { AnyObject } from "./interfaces";
import { Writer } from "./writer";

/**
 * 单引擎运行时.
 *
 * 全库只有这一处真正"走字节": 一份 AST(`Node`)、一对递归函数(`readNode` /
 * `writeNode`)。schema.ts 只负责把声明式构造器编译成 AST 并挂上 phantom 类型,
 * 运行时不再有 `StructType` 子类、双尺寸模型或第二套形状还原。
 *
 * engine 不 import schema(只 import Cursor/Writer/errors): 依赖是单向的,
 * schema -> engine, 运行时不存在循环。
 */

/** 长度来源: 常量 / 引用同层字段 / 读到末尾 / 定长记录填到末尾 */
export type Len = number | Ref | "rest" | "records";

/** 指向同层**声明在前**字段的长度引用 */
export interface Ref {
  readonly __ref: true;
  readonly field: string;
  readonly transform?: (val: number, ctx: AnyObject) => number;
}

export function isRef(v: unknown): v is Ref {
  return typeof v === "object" && v !== null && (v as Ref).__ref === true;
}

export type TypeKind = "int" | "float";

interface ScalarHandle {
  get: string;
  set: string;
  isBig: boolean;
}

const INT_HANDLE: { [size: number]: { [unsigned: number]: string } } = {
  1: { 1: "getUint8", 0: "getInt8" },
  2: { 1: "getUint16", 0: "getInt16" },
  4: { 1: "getUint32", 0: "getInt32" },
  8: { 1: "getBigUint64", 0: "getBigInt64" },
};

/** 浮点没有 2 字节形态, 宽度就是 4 或 8 */
const FLOAT_HANDLE: { [size: number]: string } = {
  4: "getFloat32",
  8: "getFloat64",
};

/**
 * 线上字节形状 -> DataView 访问器. 这是选访问器的唯一依据, 与类型名无关 ——
 * 别名(`my_float`)不会因为名字里没有 "float" 就掉进整数分支。
 */
export function scalarHandle(
  size: number,
  unsigned: boolean,
  kind: TypeKind
): ScalarHandle {
  const get =
    kind === "float" ? FLOAT_HANDLE[size] : INT_HANDLE[size]?.[unsigned ? 1 : 0];
  if (!get) {
    throw new Error(
      `不存在这种字节形状 (size=${size}, unsigned=${unsigned}, kind=${kind})`
    );
  }
  return { get, set: get.replace(/^g/, "s"), isBig: get.startsWith("getBig") };
}

// ------------------------------------------------------------------- Node

interface ScalarBase {
  size: number;
  get: string;
  set: string;
  isBig: boolean;
}

export interface ScalarNode extends ScalarBase {
  kind: "scalar";
  unsigned: boolean;
  typeKind: TypeKind;
}

/** 位序号: `{ a: 0, b: 2 }` -> 每一位 0/1 */
export interface BitsNode extends ScalarBase {
  kind: "bits";
  positions: { [k: string]: number };
}

/** 位宽: `{ a: 1, b: 2 }` -> 值域 0..2^len-1 */
export interface BitFieldsNode extends ScalarBase {
  kind: "bitFields";
  widths: { [k: string]: number };
}

export interface BytesNode {
  kind: "bytes";
  len: Len;
}

export type PatternBytes = Uint8Array | DataView;

export interface ListSyncOptions<T = any> {
  pattern: (
    prev: T,
    first: T,
    all: T[],
    ctx: AnyObject
  ) => PatternBytes;
  offset?: number;
}

export interface ListOptions<T = any> {
  sync?: ListSyncOptions<T>;
}

export interface ListNode {
  kind: "list";
  item: Node;
  len: Len;
  sync?: ListSyncOptions;
}

export interface FieldNode {
  name: string;
  node: Node;
}

export interface StructNode {
  kind: "struct";
  name: string;
  fields: FieldNode[];
  /** 显式字节序; 省略则逐级继承父级 */
  le?: boolean;
}

/** 分支字段与判别字段**平级**铺进父对象 */
export interface VariantNode {
  kind: "variant";
  keyField: string;
  cases: { [key: string]: FieldNode[] };
  select?: (tag: any) => string | undefined;
}

/** 自定义 codec: 自己描述怎么跳过一个字段 */
export interface CodecNode {
  kind: "codec";
  fixedSize?: number;
  /** `delimited`: 只能读一个, reader 返回 null 视为"这个字段不完整" */
  single?: boolean;
  read: (c: Cursor, name: string) => any;
  write: (w: Writer, v: any, name: string) => void;
}

export interface SkipNode {
  kind: "skip";
  n: number;
}

export type PatternSource =
  | PatternBytes
  | ((ctx: AnyObject) => PatternBytes);

export interface SkipUntilOptions {
  offset?: number;
  optional?: boolean;
  to?: "stay" | "end";
}

export interface SkipUntilNode {
  kind: "skipUntil";
  pattern: PatternSource;
  offset?: number;
  optional?: boolean;
  to?: "stay" | "end";
}

export type Node =
  | ScalarNode
  | BitsNode
  | BitFieldsNode
  | BytesNode
  | ListNode
  | StructNode
  | VariantNode
  | CodecNode
  | SkipNode
  | SkipUntilNode;


// -------------------------------------------------------------- fixedSize

const FIXED = new WeakMap<Node, number | undefined>();

/**
 * 单实例定长字节数; 含变长字段则为 undefined(无 ctx 时无从解析 ref)。
 * 结果缓存在 WeakMap 里 —— 同一个 AST 反复问不会重算。
 */
export function fixedSize(node: Node): number | undefined {
  if (FIXED.has(node)) return FIXED.get(node);
  let size: number | undefined;
  switch (node.kind) {
    case "scalar":
    case "bits":
    case "bitFields":
      size = node.size;
      break;
    case "skip":
      size = node.n;
      break;
    case "codec":
      size = node.fixedSize;
      break;
    case "bytes":
      size = typeof node.len === "number" ? node.len : undefined;
      break;
    case "list": {
      const item = fixedSize(node.item);
      size =
        typeof node.len === "number" && item !== undefined
          ? node.len * item
          : undefined;
      break;
    }
    case "struct": {
      let total = 0;
      for (const f of node.fields) {
        const s = fixedSize(f.node);
        if (s === undefined) {
          total = undefined as unknown as number;
          break;
        }
        total += s;
      }
      size = total;
      break;
    }
    case "variant":
    case "skipUntil":
      size = undefined;
      break;
  }
  FIXED.set(node, size);
  return size;
}

function fieldFixedSize(f: FieldNode): number | undefined {
  return fixedSize(f.node);
}

// ----------------------------------------------------------- length resolve

function specText(len: Len): string {
  if (typeof len === "number") return String(len);
  if (len === "rest") return "until:end";
  if (len === "records") return "stride";
  return `ref("${len.field}")`;
}

/**
 * 解析长度. `ctx` 是本层已解析的值对象 —— ref 只能看到声明在前的字段,
 * 因此"长度字段声明在被长度化的数据之后"会变成一条指名道姓的错误,
 * 而不是静默产出垃圾。
 */
function resolveLen(
  len: Len,
  ctx: AnyObject,
  where: string,
  offset: number,
  name: string
): number {
  if (typeof len === "number") return len;
  if (len === "rest") throw new Error("resolveLen: rest 由调用点单独处理");
  if (len === "records") throw new Error("resolveLen: records 由调用点单独处理");

  const raw = ctx[len.field];
  if (raw == null) {
    throw DecodeError.reason(
      where,
      offset,
      `${name}: ref("${len.field}") 指向的字段尚未解析 —— ` +
        `ref 只能引用同一层里声明在它之前的字段`
    );
  }
  if (typeof raw !== "number" || !Number.isFinite(raw)) {
    throw DecodeError.reason(
      where,
      offset,
      `${name}: ref("${len.field}") 取到 ${JSON.stringify(raw)}, 不是有限数字`
    );
  }
  const n = len.transform ? len.transform(raw, ctx) : raw;
  if (!Number.isFinite(n) || n < 0) {
    throw DecodeError.reason(
      where,
      offset,
      `${name}: ref("${len.field}")${
        len.transform ? " 的 transform 之后" : ""
      }得到 ${n}, 不是非负整数`
    );
  }
  return n;
}

// ------------------------------------------------------------------- read

function readScalar(c: Cursor, name: string, node: ScalarBase, le: boolean): number {
  c.need(node.size, name);
  const v = (c.view as any)[node.get](c.pos, le);
  c.pos += node.size;
  return node.isBig ? Number(v) : v;
}

export function readNode(
  node: Node,
  c: Cursor,
  name: string,
  le: boolean,
  ctx: AnyObject,
  sink?: ErrorSink
): any {
  switch (node.kind) {
    case "scalar":
      return readScalar(c, name, node, le);

    case "bits": {
      const raw = readScalar(c, name, node, le);
      const out: { [k: string]: number } = {};
      for (const [k, i] of Object.entries(node.positions)) {
        out[k] = (raw >> i) & 1;
      }
      return out;
    }

    case "bitFields": {
      const raw = readScalar(c, name, node, le);
      const out: { [k: string]: number } = {};
      let i = 0;
      for (const [k, len] of Object.entries(node.widths)) {
        let val = 0;
        for (let b = 0; b < len; b++, i++) val |= ((raw >> i) & 1) << b;
        out[k] = val;
      }
      return out;
    }

    case "bytes": {
      const n =
        node.len === "rest"
          ? c.left
          : resolveLen(node.len, ctx, c.where, c.pos, name);
      return c.bytes(n, name).slice();
    }

    case "list":
      return readList(node, c, name, le, ctx, sink);

    case "struct":
      return readStruct(node, c.sub(name), le, sink);

    case "codec": {
      const before = c.pos;
      const value = node.read(c, name);
      if (value == null && node.single) {
        throw DecodeError.reason(
          c.where,
          before,
          `${name}: 子帧不完整(reader 返回 null), 而本字段声明为单个子帧`
        );
      }
      return value;
    }

    case "variant":
      // variant 没有"自己的值", 分支字段平铺进父对象 —— 由 readField 处理
      throw new Error("readNode: variant 只能作为字段, 不能作为值");

    case "skipUntil":
      return undefined;
  }
}

function readList(
  node: ListNode,
  c: Cursor,
  name: string,
  le: boolean,
  ctx: AnyObject,
  sink?: ErrorSink
): any[] {
  const values: any[] = [];

  if (node.len === "rest") {
    // framed: 反复读一个自定界子帧直到字节耗尽 / reader 返回 null
    while (c.left > 0) {
      if (sink?.stopped) break;
      const before = c.pos;
      const value =
        node.item.kind === "codec"
          ? node.item.read(c, name)
          : readNode(node.item, c, name, le, ctx);
      if (value == null) break;
      if (c.pos === before) {
        throw DecodeError.reason(
          c.where,
          before,
          `${name}: 第 ${values.length} 个子帧没有消费任何字节, 会死循环`
        );
      }
      values.push(value);
    }
    return values;
  }

  if (node.len === "records") {
    const fs = fixedSize(node.item);
    if (fs === undefined) {
      throw new Error(
        `records("${name}"): 子结构体含变长字段, 无法按定长填到末尾`
      );
    }
    while (fs > 0 && c.left >= fs) {
      if (sink?.stopped) break;
      values.push(readNode(node.item, c, name, le, ctx));
    }
    return values;
  }

  const n = resolveLen(node.len, ctx, c.where, c.pos, name);
  for (let i = 0; i < n; i++) {
    if (sink?.stopped) break;
    if (i > 0 && node.sync) {
      const pat = node.sync.pattern(values[i - 1], values[0], values, ctx);
      const hit = c.indexOf(pat);
      if (hit === -1) {
        const err = DecodeError.reason(
          c.where,
          c.pos,
          `${name}: 无法找到第 ${i} 个元素的同步标记`
        );
        if (sink) {
          sink.errors.push(err);
          sink.stopped = true;
          break;
        }
        throw err;
      }
      c.pos = hit + (node.sync.offset ?? 0);
    }
    values.push(readNode(node.item, c, name, le, ctx, sink));
  }
  return values;
}

function pickVariant(
  node: VariantNode,
  ctx: AnyObject,
  where: string,
  offset: number,
  name: string,
  mode: "decode" | "encode"
): FieldNode[] {
  const tag = ctx[node.keyField];
  const key =
    tag == null ? undefined : node.select ? node.select(tag) : String(tag);
  const fields = key == null ? undefined : node.cases[key];
  if (!fields) {
    const reason =
      `${name}: ${node.keyField}=${JSON.stringify(tag)} 没有对应分支 (已有: ${
        Object.keys(node.cases).join(", ") || "无"
      })`;
    throw mode === "encode"
      ? new EncodeError(where, reason)
      : DecodeError.reason(where, offset, reason);
  }
  return fields;
}

function readField(
  f: FieldNode,
  c: Cursor,
  out: AnyObject,
  le: boolean,
  sink?: ErrorSink
): void {
  const node = f.node;
  if (node.kind === "skip") {
    c.skip(node.n, f.name);
    return;
  }
  if (node.kind === "skipUntil") {
    const pat =
      typeof node.pattern === "function" ? node.pattern(out) : node.pattern;
    const hit = c.indexOf(pat);
    if (hit === -1) {
      if (!node.optional) {
        throw DecodeError.reason(c.where, c.pos, `${f.name}: 无法找到同步标记`);
      }
      if (node.to === "end") {
        c.pos = c.limit;
      }
    } else {
      c.pos = hit + (node.offset ?? 0);
    }
    return;
  }
  if (node.kind === "variant") {
    const fields = pickVariant(node, out, c.where, c.pos, f.name, "decode");
    readFields(fields, c, out, le, sink);
    return;
  }
  out[f.name] = readNode(node, c, f.name, le, out, sink);
}

function readFields(
  fields: FieldNode[],
  c: Cursor,
  out: AnyObject,
  le: boolean,
  sink?: ErrorSink
): void {
  for (const f of fields) {
    if (sink?.stopped) return;
    const start = c.pos;
    try {
      readField(f, c, out, le, sink);
    } catch (e) {
      if (!sink || !(e instanceof DecodeError)) throw e;
      sink.errors.push(e);
      out[f.name] = undefined;
      c.pos = start; // 半截的推进一律回滚
      const size = fieldFixedSize(f);
      if (size === undefined || size > c.left) {
        sink.stopped = true;
        return;
      }
      c.pos = start + size;
    }
  }
}

function readStruct(
  node: StructNode,
  c: Cursor,
  inheritedLE: boolean,
  sink?: ErrorSink
): AnyObject {
  const out: AnyObject = {};
  readFields(node.fields, c, out, node.le ?? inheritedLE, sink);
  return out;
}

/** 宽松解码的失败收集器. `stopped` 表示"当前位置已经不可信" */
export interface ErrorSink {
  errors: DecodeError[];
  stopped: boolean;
}

export function decodeStruct(
  node: StructNode,
  c: Cursor,
  sink?: ErrorSink,
  inheritedLE = false
): AnyObject {
  return readStruct(node, c, inheritedLE, sink);
}

// ------------------------------------------------------------------ write

function asList(value: any): any[] {
  if (value == null) return [];
  if (ArrayBuffer.isView(value)) return Array.from(value as any);
  return Array.isArray(value) ? value : [value];
}

function toBytes(value: any, name: string): Uint8Array {
  if (value == null) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  throw new EncodeError(
    "encode",
    `${name}: 期望 Uint8Array, 实际 ${
      Array.isArray(value) ? "number[]" : typeof value
    } —— 字节只有一种形态, 文本请自己编码好再传`
  );
}

function measure(node: Node, value: any): number {
  if (node.kind === "bytes") return toBytes(value, "encode").length;
  return asList(value).length;
}

/**
 * 声明式长度回填: 按声明顺序遍历, 对本层缺失的长度字段补上"实际字节数/元素数"。
 * 写时复制 —— 绝不改调用方对象。递归进嵌套结构体 / 结构体列表 / 选中的 variant 分支。
 */
function backfillFields(
  fields: FieldNode[],
  out: AnyObject,
  le: boolean
): void {
  for (const f of fields) {
    const node = f.node;
    if (node.kind === "skip" || node.kind === "skipUntil") continue;

    if (
      (node.kind === "bytes" || node.kind === "list") &&
      isRef(node.len) &&
      !node.len.transform &&
      out[node.len.field] == null &&
      out[f.name] != null
    ) {
      out[node.len.field] = measure(node, out[f.name]);
    }

    if (node.kind === "struct") {
      out[f.name] = backfillStruct(node, out[f.name], le);
    } else if (node.kind === "variant") {
      const branch = pickVariant(node, out, "encode", 0, f.name, "encode");
      backfillFields(branch, out, le);
    } else if (node.kind === "list" && node.item.kind === "struct") {
      out[f.name] = asList(out[f.name]).map((it) =>
        backfillStruct(node.item as StructNode, it, le)
      );
    } else if (node.kind === "list" && node.item.kind === "variant") {
      out[f.name] = asList(out[f.name]).map((it) => {
        const v = it == null ? {} : { ...it };
        const branch = pickVariant(
          node.item as VariantNode,
          v,
          "encode",
          0,
          f.name,
          "encode"
        );
        backfillFields(branch, v, le);
        return v;
      });
    }
  }
}

function backfillStruct(
  node: StructNode,
  value: any,
  inheritedLE: boolean
): AnyObject {
  const out: AnyObject = value == null ? {} : { ...value };
  backfillFields(node.fields, out, node.le ?? inheritedLE);
  return out;
}

function writeScalar(
  w: Writer,
  node: ScalarBase,
  value: any,
  le: boolean
): void {
  w.accessor(node.size, node.set, node.isBig, value, le);
}

export function writeNode(
  node: Node,
  w: Writer,
  value: any,
  name: string,
  le: boolean,
  ctx: AnyObject
): void {
  switch (node.kind) {
    case "scalar":
      writeScalar(w, node, value ?? 0, le);
      return;

    case "bits": {
      let flags = 0;
      for (const [k, i] of Object.entries(node.positions)) {
        const bit = value?.[k] ?? 0;
        if (bit !== 0 && bit !== 1) {
          throw new EncodeError(
            "encode",
            `bits("${k}"): 位只能是 0 或 1, 实际 ${JSON.stringify(bit)}`
          );
        }
        flags |= bit << i;
      }
      writeScalar(w, node, flags, le);
      return;
    }

    case "bitFields": {
      let flags = 0;
      let shift = 0;
      for (const [k, len] of Object.entries(node.widths)) {
        const v = value?.[k] ?? 0;
        if (!Number.isInteger(v) || v < 0 || v >= 2 ** len) {
          throw new EncodeError(
            "encode",
            `bitFields("${k}"): 值 ${JSON.stringify(v)} 放不进 ${len} 位 (0..${
              2 ** len - 1
            })`
          );
        }
        flags |= v << shift;
        shift += len;
      }
      writeScalar(w, node, flags, le);
      return;
    }

    case "bytes": {
      if (node.len === "rest") {
        w.bytes(toBytes(value, name));
        return;
      }
      const n =
        typeof node.len === "number"
          ? node.len
          : resolveLen(node.len, ctx, "encode", w.pos, name);
      const src = toBytes(value, name);
      const out = new Uint8Array(n);
      out.set(src.subarray(0, n));
      w.bytes(out);
      return;
    }

    case "list": {
      const items = asList(value);
      let n: number;
      if (node.len === "rest" || node.len === "records") {
        n = items.length;
      } else {
        n = resolveLen(node.len, ctx, "encode", w.pos, name);
      }
      if (items.length === 0 && value == null) {
        const fs = fixedSize(node.item);
        if (n > 0 && fs === undefined) {
          throw new EncodeError(
            "encode",
            `${name}: 含变长元素, 无法按定长填充`
          );
        }
        w.zero((fs ?? 0) * n);
        return;
      }
      if (items.length < n) {
        throw new EncodeError(
          "encode",
          `${name}: 需要 ${n} 个元素(${specText(node.len)}), 实际给了 ${items.length}`
        );
      }
      for (let i = 0; i < n; i++) {
        writeNode(node.item, w, items[i], name, le, ctx);
      }
      return;
    }

    case "struct":
      writeStruct(node, w, value, le);
      return;

    case "codec":
      node.write(w, value, name);
      return;

    case "skipUntil":
      return;

    case "variant":
      throw new Error("writeNode: variant 只能作为字段, 不能作为值");
  }
}

function writeField(
  f: FieldNode,
  w: Writer,
  out: AnyObject,
  le: boolean
): void {
  const node = f.node;
  if (node.kind === "skip") {
    w.zero(node.n);
    return;
  }
  if (node.kind === "skipUntil") {
    return;
  }
  if (node.kind === "variant") {
    const branch = pickVariant(node, out, "encode", w.pos, f.name, "encode");
    for (const bf of branch) writeField(bf, w, out, le);
    return;
  }
  writeNode(node, w, out[f.name], f.name, le, out);
}

export function writeStruct(
  node: StructNode,
  w: Writer,
  value: any,
  inheritedLE: boolean
): void {
  const out = backfillStruct(node, value, inheritedLE);
  const le = node.le ?? inheritedLE;
  for (const f of node.fields) writeField(f, w, out, le);
}

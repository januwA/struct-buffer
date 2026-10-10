"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/index.ts
var index_exports = {};
__export(index_exports, {
  Cursor: () => Cursor,
  DecodeError: () => DecodeError,
  EncodeError: () => EncodeError,
  TEXT: () => TEXT,
  Writer: () => Writer,
  bitFields: () => bitFields,
  bits: () => bits,
  bytes: () => bytes,
  codec: () => codec,
  createDataView: () => createDataView,
  delimited: () => delimited,
  display: () => display,
  double: () => double,
  float: () => float,
  framed: () => framed,
  int16_t: () => int16_t,
  int32_t: () => int32_t,
  int64_t: () => int64_t,
  int8_t: () => int8_t,
  isRef: () => isRef,
  list: () => list,
  makeDataView: () => makeDataView,
  records: () => records,
  ref: () => ref,
  registerType: () => registerType,
  rest: () => rest,
  sbytes: () => sbytes,
  sbytes2: () => sbytes2,
  skip: () => skip,
  skipUntil: () => skipUntil,
  struct: () => struct,
  sview: () => sview,
  transform: () => transform,
  uint16_t: () => uint16_t,
  uint32_t: () => uint32_t,
  uint64_t: () => uint64_t,
  uint8_t: () => uint8_t,
  variant: () => variant
});
module.exports = __toCommonJS(index_exports);

// src/errors.ts
var DecodeError = class _DecodeError extends Error {
  constructor(where, offset, need, have, hex) {
    super(
      `DecodeError: ${where} @${offset} 需要 ${need}B, 只剩 ${have}B` + (hex ? `  hex: ${hex}` : "")
    );
    this.where = where;
    this.offset = offset;
    this.need = need;
    this.have = have;
    this.hex = hex;
    this.name = "DecodeError";
    Object.setPrototypeOf(this, _DecodeError.prototype);
  }
  /**
   * 不是"字节不够", 而是**字节够但内容不对**(判别字段没有对应分支 / 子帧没前进).
   * 这类错误没有"需要几字节"可言, 硬塞进 hex 槽位只会让消息变成
   * `需要 0B, 只剩 0B hex: msg_type=3 没有对应分支` —— 越读越糊涂.
   */
  static reason(where, offset, reason) {
    const e = new _DecodeError(where, offset, 0, 0, "");
    e.message = `DecodeError: ${where} @${offset} ${reason}`;
    return e;
  }
};
var EncodeError = class _EncodeError extends Error {
  constructor(where, message) {
    super(`EncodeError: ${where} ${message}`);
    this.where = where;
    this.name = "EncodeError";
    Object.setPrototypeOf(this, _EncodeError.prototype);
  }
};

// src/utils.ts
function createDataView(byteLength, view) {
  return view ? view : new DataView(new ArrayBuffer(byteLength));
}
function makeDataView(view) {
  if (view instanceof DataView) return view;
  if (Array.isArray(view)) view = Uint8Array.from(view);
  if (!ArrayBuffer.isView(view))
    throw new Error(`Type Error: (${view}) is not an ArrayBuffer!!!`);
  return new DataView(view.buffer, view.byteOffset, view.byteLength);
}
function sbytes(str) {
  str = str.replace(/0x|h|\\x|\s/gi, "");
  if (str.length % 2 !== 0) str = str.slice(0, -1);
  str = str.replace(/([0-9a-f]{2})(?=[0-9a-f])/gi, "$1 ");
  return new DataView(
    Uint8Array.from(str.split(/\s+/).map((it) => parseInt(it, 16))).buffer
  );
}
var HEX_EXP = /^(0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2}))/i;
var HEX_SEARCH_EXP = /0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2})/i;
function sbytes2(str, encoder) {
  let m;
  const bytes2 = [];
  while (str.length) {
    m = str.match(HEX_EXP);
    if (m && m[1]) {
      const v = m[2] ?? m[3] ?? m[4] ?? 0;
      bytes2.push(parseInt(v, 16));
      str = str.substr(m[1].length);
    } else if (str.length) {
      if (!encoder)
        throw new Error(
          "sbytes2: 输入含非十六进制文本, 请传入文本编码器 (如 new TextEncoder())"
        );
      const i = str.search(HEX_SEARCH_EXP);
      if (i < 0) {
        bytes2.push(...encoder.encode(str));
        str = "";
      } else {
        const s = str.substr(0, i);
        bytes2.push(...encoder.encode(s));
        str = str.substr(i);
      }
    }
  }
  return new DataView(Uint8Array.from(bytes2).buffer);
}
function sview(view) {
  const v = makeDataView(view);
  const lst = [];
  for (let i = 0; i < v.byteLength; i++) {
    lst.push(v.getUint8(i).toString(16).padStart(2, "0"));
  }
  return lst.join(" ");
}
function TEXT(buf, decoder, placeholder) {
  const view = makeDataView(buf);
  let offset = 0;
  let str = "";
  let strBytes = [];
  while (true) {
    try {
      const byte = view.getUint8(offset++);
      if (byte >= 32) {
        strBytes.push(byte);
      } else {
        if (strBytes.length) {
          str += decoder.decode(Uint8Array.from(strBytes));
          strBytes = [];
        }
        str += placeholder ? typeof placeholder === "string" ? placeholder : placeholder(byte) : ".";
      }
    } catch {
      if (strBytes.length) str += decoder.decode(Uint8Array.from(strBytes));
      break;
    }
  }
  return str;
}

// src/cursor.ts
var Cursor = class _Cursor {
  constructor(view, pos = 0, end, where = "", st) {
    this.end = end;
    this.where = where;
    this.view = makeDataView(view);
    this.st = st ?? { pos };
  }
  get pos() {
    return this.st.pos;
  }
  set pos(v) {
    this.st.pos = v;
  }
  /**
   * **同一位置的另一个标签**: 嵌套结构体用它把错误定位串带进子结构
   * (`Outer` → `Outer.inner`) 而不必真的划子窗口 —— 位置照旧是同一个, 所以父字段
   * 不需要知道子结构体消费了多少字节。
   *
   * 与 `region()` 的区别: `region` 开一个**独立**的定长窗口, `sub` 只是加标签。
   */
  sub(field) {
    return new _Cursor(this.view, this.pos, this.end, this.label(field), this.st);
  }
  get limit() {
    return this.end ?? this.view.byteLength;
  }
  /** 剩余可读字节数 */
  get left() {
    return this.limit - this.pos;
  }
  get done() {
    return this.pos >= this.limit;
  }
  /** 拼出完整定位串, 如 `InFrame` + `body` => `InFrame.body` */
  label(field) {
    return this.where ? `${this.where}.${field}` : field;
  }
  /** 越界 = 抛包装过的 DecodeError(带 where/offset/hex), 绝不漏出裸 RangeError */
  need(n, field) {
    if (n > this.left) throw this.error(field, n);
  }
  error(field, need) {
    const where = this.label(field);
    const hex = this.pos < this.view.byteLength ? this.view.getUint8(this.pos).toString(16).padStart(2, "0") : "";
    return new DecodeError(where, this.pos, need, this.left, hex);
  }
  skip(n, field) {
    this.need(n, field);
    this.pos += n;
  }
  // ---- 标量读取: 每个都带边界检查, littleEndian 由调用方从 schema 继承 ----
  u8(field) {
    this.need(1, field);
    return this.view.getUint8(this.pos++);
  }
  i8(field) {
    this.need(1, field);
    return this.view.getInt8(this.pos++);
  }
  u16(field, le = false) {
    this.need(2, field);
    const v = this.view.getUint16(this.pos, le);
    this.pos += 2;
    return v;
  }
  i16(field, le = false) {
    this.need(2, field);
    const v = this.view.getInt16(this.pos, le);
    this.pos += 2;
    return v;
  }
  u32(field, le = false) {
    this.need(4, field);
    const v = this.view.getUint32(this.pos, le);
    this.pos += 4;
    return v;
  }
  i32(field, le = false) {
    this.need(4, field);
    const v = this.view.getInt32(this.pos, le);
    this.pos += 4;
    return v;
  }
  f32(field, le = false) {
    this.need(4, field);
    const v = this.view.getFloat32(this.pos, le);
    this.pos += 4;
    return v;
  }
  f64(field, le = false) {
    this.need(8, field);
    const v = this.view.getFloat64(this.pos, le);
    this.pos += 8;
    return v;
  }
  u64(field, le = false) {
    this.need(8, field);
    const v = this.view.getBigUint64(this.pos, le);
    this.pos += 8;
    return Number(v);
  }
  i64(field, le = false) {
    this.need(8, field);
    const v = this.view.getBigInt64(this.pos, le);
    this.pos += 8;
    return Number(v);
  }
  /**
     * 取 n 字节**零拷贝**子视图(借用底层 buffer, 不复制).
     * 字节字段(`rest()`)用它把字节直接交出去; 解码源本身是 `readByteArray` 出来的
     * 独立拷贝, 所以子视图的生命周期安全。
     */
  bytes(n, field) {
    this.need(n, field);
    const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
    this.pos += n;
    return v;
  }
  /**
   * 定长子区域: 划出 n 字节窗口交给 `fn` 解析, 结束后父 cursor **整块跳过** n 字节.
   *
   * 区域尾部没被 `fn` 消费的字节(对齐填充/未知尾巴)不会漏进父结构, 也不会让父结构错位。
   * 自定界子帧(`framed`)与"长度头 + 子体"类字段靠它与外界隔离。
   */
  region(n, field, fn) {
    this.need(n, field);
    const start = this.pos;
    const value = fn(
      new _Cursor(this.view, start, start + n, this.label(field))
    );
    this.pos = start + n;
    return value;
  }
  /**
   * 只读子区域: 不消费父 cursor, 返回子结果与实际消费字节数.
   * 帧尾残余字节之类"看到了但不属于本结构"的数据用这个.
   */
  peek(n, field, fn) {
    this.need(n, field);
    const start = this.pos;
    const child = new _Cursor(this.view, start, start + n, this.label(field));
    const value = fn(child);
    return { value, size: child.pos - start };
  }
  /** 从当前 pos 到 limit 剩余全部字节, 零拷贝 */
  rest(field) {
    return this.bytes(this.left, field);
  }
  /**
   * 在当前游标范围 [pos, limit) 内查找特征字节 pattern.
   * 找到返回相对 view 起点的绝对偏移 offset, 未找到返回 -1.
   */
  indexOf(pattern) {
    const p = pattern instanceof Uint8Array ? pattern : new Uint8Array(
      pattern.buffer,
      pattern.byteOffset,
      pattern.byteLength
    );
    const pLen = p.length;
    if (pLen === 0) return this.pos;
    const limit = this.limit - pLen;
    const view = this.view;
    const first = p[0];
    for (let i = this.pos; i <= limit; i++) {
      if (view.getUint8(i) === first) {
        let matched = true;
        for (let j = 1; j < pLen; j++) {
          if (view.getUint8(i + j) !== p[j]) {
            matched = false;
            break;
          }
        }
        if (matched) return i;
      }
    }
    return -1;
  }
};

// src/engine.ts
function isRef(v) {
  return typeof v === "object" && v !== null && v.__ref === true;
}
var INT_HANDLE = {
  1: { 1: "getUint8", 0: "getInt8" },
  2: { 1: "getUint16", 0: "getInt16" },
  4: { 1: "getUint32", 0: "getInt32" },
  8: { 1: "getBigUint64", 0: "getBigInt64" }
};
var FLOAT_HANDLE = {
  4: "getFloat32",
  8: "getFloat64"
};
function scalarHandle(size, unsigned, kind) {
  const get = kind === "float" ? FLOAT_HANDLE[size] : INT_HANDLE[size]?.[unsigned ? 1 : 0];
  if (!get) {
    throw new Error(
      `不存在这种字节形状 (size=${size}, unsigned=${unsigned}, kind=${kind})`
    );
  }
  return { get, set: get.replace(/^g/, "s"), isBig: get.startsWith("getBig") };
}
var FIXED = /* @__PURE__ */ new WeakMap();
function fixedSize(node) {
  if (FIXED.has(node)) return FIXED.get(node);
  let size;
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
    case "transform":
      size = fixedSize(node.inner);
      break;
    case "bytes":
      size = typeof node.len === "number" ? node.len : void 0;
      break;
    case "list": {
      const item = fixedSize(node.item);
      size = typeof node.len === "number" && item !== void 0 ? node.len * item : void 0;
      break;
    }
    case "struct": {
      let total = 0;
      for (const f of node.fields) {
        const s = fixedSize(f.node);
        if (s === void 0) {
          total = void 0;
          break;
        }
        total += s;
      }
      size = total;
      break;
    }
    case "variant":
    case "skipUntil":
      size = void 0;
      break;
  }
  FIXED.set(node, size);
  return size;
}
function fieldFixedSize(f) {
  return fixedSize(f.node);
}
function specText(len) {
  if (typeof len === "number") return String(len);
  if (len === "rest") return "until:end";
  if (len === "records") return "stride";
  return `ref("${len.field}")`;
}
function resolveLen(len, ctx, where, offset, name) {
  if (typeof len === "number") return len;
  if (len === "rest") throw new Error("resolveLen: rest 由调用点单独处理");
  if (len === "records") throw new Error("resolveLen: records 由调用点单独处理");
  const raw = ctx[len.field];
  if (raw == null) {
    throw DecodeError.reason(
      where,
      offset,
      `${name}: ref("${len.field}") 指向的字段尚未解析 —— ref 只能引用同一层里声明在它之前的字段`
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
      `${name}: ref("${len.field}")${len.transform ? " 的 transform 之后" : ""}得到 ${n}, 不是非负整数`
    );
  }
  return n;
}
function readScalar(c, name, node, le) {
  c.need(node.size, name);
  const v = c.view[node.get](c.pos, le);
  c.pos += node.size;
  return node.isBig ? Number(v) : v;
}
function readNode(node, c, name, le, ctx, sink) {
  switch (node.kind) {
    case "scalar":
      return readScalar(c, name, node, le);
    case "bits": {
      const raw = readScalar(c, name, node, le);
      const out = {};
      for (const [k, i] of Object.entries(node.positions)) {
        out[k] = raw >> i & 1;
      }
      return out;
    }
    case "bitFields": {
      const raw = readScalar(c, name, node, le);
      const out = {};
      let i = 0;
      for (const [k, len] of Object.entries(node.widths)) {
        let val = 0;
        for (let b = 0; b < len; b++, i++) val |= (raw >> i & 1) << b;
        out[k] = val;
      }
      return out;
    }
    case "bytes": {
      const n = node.len === "rest" ? c.left : resolveLen(node.len, ctx, c.where, c.pos, name);
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
    case "transform": {
      const raw = readNode(node.inner, c, name, le, ctx, sink);
      return node.decode(raw, ctx);
    }
    case "variant":
      throw new Error("readNode: variant 只能作为字段, 不能作为值");
    case "skipUntil":
      return void 0;
  }
}
function readList(node, c, name, le, ctx, sink) {
  const values = [];
  if (node.len === "rest") {
    while (c.left > 0) {
      if (sink?.stopped) break;
      const before = c.pos;
      const value = node.item.kind === "codec" ? node.item.read(c, name) : readNode(node.item, c, name, le, ctx);
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
    if (fs === void 0) {
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
function pickVariant(node, ctx, where, offset, name, mode) {
  const tag = ctx[node.keyField];
  const key = tag == null ? void 0 : node.select ? node.select(tag) : String(tag);
  const fields = key == null ? void 0 : node.cases[key];
  if (!fields) {
    const reason = `${name}: ${node.keyField}=${JSON.stringify(tag)} 没有对应分支 (已有: ${Object.keys(node.cases).join(", ") || "无"})`;
    throw mode === "encode" ? new EncodeError(where, reason) : DecodeError.reason(where, offset, reason);
  }
  return fields;
}
function readField(f, c, out, le, sink) {
  const node = f.node;
  if (node.kind === "skip") {
    c.skip(node.n, f.name);
    return;
  }
  if (node.kind === "skipUntil") {
    const pat = typeof node.pattern === "function" ? node.pattern(out) : node.pattern;
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
function readFields(fields, c, out, le, sink) {
  for (const f of fields) {
    if (sink?.stopped) return;
    const start = c.pos;
    try {
      readField(f, c, out, le, sink);
    } catch (e) {
      if (!sink || !(e instanceof DecodeError)) throw e;
      sink.errors.push(e);
      out[f.name] = void 0;
      c.pos = start;
      const size = fieldFixedSize(f);
      if (size === void 0 || size > c.left) {
        sink.stopped = true;
        return;
      }
      c.pos = start + size;
    }
  }
}
function readStruct(node, c, inheritedLE, sink) {
  const out = {};
  readFields(node.fields, c, out, node.le ?? inheritedLE, sink);
  return out;
}
function decodeStruct(node, c, sink, inheritedLE = false) {
  return readStruct(node, c, inheritedLE, sink);
}
function asList(value) {
  if (value == null) return [];
  if (ArrayBuffer.isView(value)) return Array.from(value);
  return Array.isArray(value) ? value : [value];
}
function toBytes(value, name) {
  if (value == null) return new Uint8Array(0);
  if (value instanceof Uint8Array) return value;
  throw new EncodeError(
    "encode",
    `${name}: 期望 Uint8Array, 实际 ${Array.isArray(value) ? "number[]" : typeof value} —— 字节只有一种形态, 文本请自己编码好再传`
  );
}
function measure(node, value) {
  if (node.kind === "bytes") return toBytes(value, "encode").length;
  return asList(value).length;
}
function backfillFields(fields, out, le) {
  for (const f of fields) {
    const node = f.node;
    if (node.kind === "skip" || node.kind === "skipUntil") continue;
    if ((node.kind === "bytes" || node.kind === "list") && isRef(node.len) && !node.len.transform && out[node.len.field] == null && out[f.name] != null) {
      out[node.len.field] = measure(node, out[f.name]);
    }
    if (node.kind === "struct") {
      out[f.name] = backfillStruct(node, out[f.name], le);
    } else if (node.kind === "variant") {
      const branch = pickVariant(node, out, "encode", 0, f.name, "encode");
      backfillFields(branch, out, le);
    } else if (node.kind === "list" && node.item.kind === "struct") {
      out[f.name] = asList(out[f.name]).map(
        (it) => backfillStruct(node.item, it, le)
      );
    } else if (node.kind === "list" && node.item.kind === "variant") {
      out[f.name] = asList(out[f.name]).map((it) => {
        const v = it == null ? {} : { ...it };
        const branch = pickVariant(
          node.item,
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
function backfillStruct(node, value, inheritedLE) {
  const out = value == null ? {} : { ...value };
  backfillFields(node.fields, out, node.le ?? inheritedLE);
  return out;
}
function writeScalar(w, node, value, le) {
  w.accessor(node.size, node.set, node.isBig, value, le);
}
function writeNode(node, w, value, name, le, ctx) {
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
            `bitFields("${k}"): 值 ${JSON.stringify(v)} 放不进 ${len} 位 (0..${2 ** len - 1})`
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
      const n = typeof node.len === "number" ? node.len : resolveLen(node.len, ctx, "encode", w.pos, name);
      const src = toBytes(value, name);
      const out = new Uint8Array(n);
      out.set(src.subarray(0, n));
      w.bytes(out);
      return;
    }
    case "list": {
      const items = asList(value);
      let n;
      if (node.len === "rest" || node.len === "records") {
        n = items.length;
      } else {
        n = resolveLen(node.len, ctx, "encode", w.pos, name);
      }
      if (items.length === 0 && value == null) {
        const fs = fixedSize(node.item);
        if (n > 0 && fs === void 0) {
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
    case "transform": {
      if (!node.encode) {
        throw new EncodeError(
          "encode",
          `${name}: transform 字段未提供 encode 函数`
        );
      }
      const raw = node.encode(value, ctx);
      writeNode(node.inner, w, raw, name, le, ctx);
      return;
    }
    case "skipUntil":
      return;
    case "variant":
      throw new Error("writeNode: variant 只能作为字段, 不能作为值");
  }
}
function writeField(f, w, out, le) {
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
function writeStruct(node, w, value, inheritedLE) {
  const out = backfillStruct(node, value, inheritedLE);
  const le = node.le ?? inheritedLE;
  for (const f of node.fields) writeField(f, w, out, le);
}

// src/writer.ts
var MIN_CAPACITY = 64;
var Writer = class {
  constructor(opts) {
    this.opts = opts;
    this.pos = 0;
    this.fixed = !!opts.view;
    this.buf = opts.view ?? new DataView(new ArrayBuffer(opts.capacity ?? MIN_CAPACITY));
    this.start = opts.offset ?? 0;
    this.pos = this.start;
  }
  get littleEndian() {
    return this.opts.littleEndian;
  }
  /** 底层 buffer(不切片). 交给 `StructType.encode` 就地写时用这个 */
  get raw() {
    return this.buf;
  }
  /** 还能写多少字节(定长模式) */
  get room() {
    return this.fixed ? this.buf.byteLength - this.pos : Infinity;
  }
  /**
   * 保证还能写 n 字节. `StructType.encode` 拿到 view 后是**盲写**(不检查
   * `createDataView(size, view)` 直接返回 view), 所以必须先扩容, 否则会漏出
   * 裸 `RangeError`.
   */
  reserve(n) {
    this.grow(n);
  }
  /**
   * `StructType.encode` 内部换了底层 buffer 时换回来. 偏移语义不变: 新 view 同样从 0
   * 开始, 所以绝对 offset 可以直接沿用.
   */
  rebind(view) {
    this.buf = view;
  }
  advance(n) {
    this.pos += n;
  }
  grow(n) {
    if (this.pos + n <= this.buf.byteLength) return;
    if (this.fixed) {
      throw new EncodeError(
        "encodeInto",
        `写入越界: 需要 ${n}B, 只剩 ${this.room}B (pos=${this.pos}, view=${this.buf.byteLength}B)`
      );
    }
    const need = this.pos + n;
    let cap = this.buf.byteLength || MIN_CAPACITY;
    while (cap < need) cap *= 2;
    const next = new DataView(new ArrayBuffer(cap));
    for (let i = 0; i < this.pos; i++) next.setUint8(i, this.buf.getUint8(i));
    this.buf = next;
  }
  u8(v) {
    this.grow(1);
    this.buf.setUint8(this.pos++, v & 255);
  }
  i8(v) {
    this.grow(1);
    this.buf.setInt8(this.pos++, v << 24 >> 24);
  }
  u16(v) {
    this.grow(2);
    this.buf.setUint16(this.pos, v, this.opts.littleEndian);
    this.pos += 2;
  }
  i16(v) {
    this.grow(2);
    this.buf.setInt16(this.pos, v, this.opts.littleEndian);
    this.pos += 2;
  }
  u32(v) {
    this.grow(4);
    this.buf.setUint32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }
  i32(v) {
    this.grow(4);
    this.buf.setInt32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }
  f32(v) {
    this.grow(4);
    this.buf.setFloat32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }
  f64(v) {
    this.grow(8);
    this.buf.setFloat64(this.pos, v, this.opts.littleEndian);
    this.pos += 8;
  }
  u64(v) {
    this.grow(8);
    this.buf.setBigUint64(this.pos, BigInt(v), this.opts.littleEndian);
    this.pos += 8;
  }
  i64(v) {
    this.grow(8);
    this.buf.setBigInt64(this.pos, BigInt(v), this.opts.littleEndian);
    this.pos += 8;
  }
  /**
   * 按字节形状写: `scalarHandle` 给出的 DataView 访问器名 + 是否 BigInt。
   * 引擎唯一写标量的入口, 免得为每种宽度各写一份 `if`。
   */
  accessor(size, set, isBig, value, le) {
    this.grow(size);
    this.buf[set](this.pos, isBig ? BigInt(value) : value, le);
    this.pos += size;
  }
  bytes(src) {
    this.grow(src.length);
    for (let i = 0; i < src.length; i++) this.buf.setUint8(this.pos++, src[i]);
  }
  zero(n) {
    this.grow(n);
    while (n-- > 0) this.buf.setUint8(this.pos++, 0);
  }
  /** 已写入字节数(不含定长模式下的 start 偏移) */
  get written() {
    return this.pos - this.start;
  }
  /** 定长模式返回原 view; 可增长模式返回恰好 `written` 字节的切片 */
  finish() {
    return this.fixed ? this.buf : new DataView(
      this.buf.buffer.slice(
        this.buf.byteOffset + this.start,
        this.buf.byteOffset + this.pos
      )
    );
  }
};

// src/schema.ts
function make(node) {
  const codec2 = {
    node,
    decode(view, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      return readNode(node, c, "value", littleEndian, {});
    },
    decodeLenient(view, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      const sink = { errors: [], stopped: false };
      const value = readNode(node, c, "value", littleEndian, {}, sink);
      return { value, errors: sink.errors, consumed: c.pos - offset };
    },
    encode(value, littleEndian = false, offset = 0, view) {
      const w = new Writer({ view, offset, littleEndian });
      writeNode(node, w, value, "value", littleEndian, {});
      return w.finish();
    }
  };
  return codec2;
}
function nodeOf(codec2) {
  return codec2.node;
}
function registerType(size, unsigned = true, kind = "int") {
  const h = scalarHandle(size, unsigned, kind);
  const node = {
    kind: "scalar",
    size,
    unsigned,
    typeKind: kind,
    get: h.get,
    set: h.set,
    isBig: h.isBig
  };
  const codec2 = {
    node,
    size,
    unsigned,
    kind,
    get: h.get,
    set: h.set,
    decode(view, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset);
      return readNode(node, c, "value", littleEndian, {});
    },
    encode(value, littleEndian = false, offset = 0, view) {
      const w = new Writer({ view, offset, littleEndian });
      writeNode(node, w, value, "value", littleEndian, {});
      return w.finish();
    }
  };
  return codec2;
}
var int8_t = registerType(1, false);
var int16_t = registerType(2, false);
var int32_t = registerType(4, false);
var int64_t = registerType(8, false);
var uint8_t = registerType(1, true);
var uint16_t = registerType(2, true);
var uint32_t = registerType(4, true);
var uint64_t = registerType(8, true);
var float = registerType(4, true, "float");
var double = registerType(8, true, "float");
function ref(field, transform2) {
  return { __ref: true, field, transform: transform2 };
}
function bytes(len) {
  return make({ kind: "bytes", len });
}
function rest() {
  return bytes("rest");
}
function list(item, len, opts) {
  return make({
    kind: "list",
    item: nodeOf(item),
    len,
    sync: opts?.sync
  });
}
function records(source, len) {
  const item = nodeOf(source);
  if (len === void 0 && fixedSize(item) === void 0) {
    throw new TypeError(
      `records("${item.name ?? ""}"): 子结构体含变长字段, 无法按定长填到末尾 —— 请显式给长度, 或改用 ref/framed`
    );
  }
  return make({
    kind: "list",
    item,
    len: len ?? "records"
  });
}
function assertBitsStorage(size, kind) {
  if (size !== 1 && size !== 2 && size !== 4) {
    throw new TypeError(
      `${kind}: 只支持 1/2/4 字节的存储(位运算走 JS 32 位整数), 实际 ${size}`
    );
  }
}
function bits(storage, positions) {
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
  return make({
    kind: "bits",
    size,
    ...h,
    positions
  });
}
function bitFields(storage, widths) {
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
  return make({
    kind: "bitFields",
    size,
    ...h,
    widths
  });
}
function skip(n) {
  return make({ kind: "skip", n });
}
function skipUntil(pattern, opts) {
  return make({
    kind: "skipUntil",
    pattern,
    offset: opts?.offset,
    optional: opts?.optional,
    to: opts?.to
  });
}
function compileFields(def) {
  return Object.entries(def).map(([name, codec2]) => ({
    name,
    node: nodeOf(codec2)
  }));
}
function struct(name, def, config) {
  const node = {
    kind: "struct",
    name,
    fields: compileFields(def),
    le: config?.littleEndian
  };
  const codec2 = {
    node,
    name,
    struct: def,
    decode(view, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset, void 0, name);
      return decodeStruct(node, c, void 0, littleEndian);
    },
    decodeLenient(view, littleEndian = false, offset = 0) {
      const c = new Cursor(view, offset, void 0, name);
      const sink = { errors: [], stopped: false };
      const value = decodeStruct(node, c, sink, littleEndian);
      return { value, errors: sink.errors, consumed: c.pos - offset };
    },
    encode(obj, littleEndian = false, offset = 0, view) {
      const w = new Writer({
        view,
        offset,
        littleEndian: config?.littleEndian ?? littleEndian
      });
      writeStruct(node, w, obj, littleEndian);
      return w.finish();
    }
  };
  return codec2;
}
function compileVariantCases(cases) {
  const out = {};
  for (const [k, def] of Object.entries(cases)) {
    out[k] = compileFields(def);
  }
  return out;
}
function variant(keyField, cases, opts) {
  const node = {
    kind: "variant",
    keyField,
    cases: compileVariantCases(cases),
    select: opts?.select
  };
  return make(node);
}
function toCodecNode(spec, single) {
  return {
    kind: "codec",
    fixedSize: spec.fixedSize,
    single,
    read: spec.read,
    write: spec.write
  };
}
function codec(spec) {
  return make(toCodecNode(spec, false));
}
function delimited(spec) {
  return make(toCodecNode(spec, true));
}
function framed(spec) {
  return make({
    kind: "list",
    item: toCodecNode(spec, false),
    len: "rest"
  });
}
function transform(inner, spec) {
  const innerNode = nodeOf(inner);
  const decodeFn = typeof spec === "function" ? spec : spec.decode;
  const encodeFn = typeof spec === "function" ? void 0 : spec.encode;
  const node = {
    kind: "transform",
    inner: innerNode,
    decode: decodeFn,
    encode: encodeFn
  };
  return make(node);
}

// src/display.ts
function display(view, type, options) {
  const node = type.node;
  const opts = Object.assign({ hex: true, littleEndian: false }, options);
  let offset = 0;
  const result = [];
  while (true) {
    try {
      let value = view[node.get](offset, opts.littleEndian);
      if (opts.hex) {
        value = value.toString(16).toUpperCase().padStart(node.size * 2, "0");
      }
      result.push({ offset, value });
      offset += node.size;
    } catch {
      break;
    }
  }
  return result;
}
//# sourceMappingURL=index.cjs.map

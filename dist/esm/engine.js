import { DecodeError, EncodeError } from "./errors";
export function isRef(v) {
    return typeof v === "object" && v !== null && v.__ref === true;
}
const INT_HANDLE = {
    1: { 1: "getUint8", 0: "getInt8" },
    2: { 1: "getUint16", 0: "getInt16" },
    4: { 1: "getUint32", 0: "getInt32" },
    8: { 1: "getBigUint64", 0: "getBigInt64" },
};
const FLOAT_HANDLE = {
    4: "getFloat32",
    8: "getFloat64",
};
export function scalarHandle(size, unsigned, kind) {
    const get = kind === "float" ? FLOAT_HANDLE[size] : INT_HANDLE[size]?.[unsigned ? 1 : 0];
    if (!get) {
        throw new Error(`不存在这种字节形状 (size=${size}, unsigned=${unsigned}, kind=${kind})`);
    }
    return { get, set: get.replace(/^g/, "s"), isBig: get.startsWith("getBig") };
}
const FIXED = new WeakMap();
export function fixedSize(node) {
    if (FIXED.has(node))
        return FIXED.get(node);
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
                    total = undefined;
                    break;
                }
                total += s;
            }
            size = total;
            break;
        }
        case "variant":
            size = undefined;
            break;
    }
    FIXED.set(node, size);
    return size;
}
function fieldFixedSize(f) {
    return fixedSize(f.node);
}
function specText(len) {
    if (typeof len === "number")
        return String(len);
    if (len === "rest")
        return "until:end";
    if (len === "records")
        return "stride";
    return `ref("${len.field}")`;
}
function resolveLen(len, ctx, where, offset, name) {
    if (typeof len === "number")
        return len;
    if (len === "rest")
        throw new Error("resolveLen: rest 由调用点单独处理");
    if (len === "records")
        throw new Error("resolveLen: records 由调用点单独处理");
    const raw = ctx[len.field];
    if (raw == null) {
        throw DecodeError.reason(where, offset, `${name}: ref("${len.field}") 指向的字段尚未解析 —— ` +
            `ref 只能引用同一层里声明在它之前的字段`);
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        throw DecodeError.reason(where, offset, `${name}: ref("${len.field}") 取到 ${JSON.stringify(raw)}, 不是有限数字`);
    }
    const n = len.transform ? len.transform(raw, ctx) : raw;
    if (!Number.isFinite(n) || n < 0) {
        throw DecodeError.reason(where, offset, `${name}: ref("${len.field}")${len.transform ? " 的 transform 之后" : ""}得到 ${n}, 不是非负整数`);
    }
    return n;
}
function readScalar(c, name, node, le) {
    c.need(node.size, name);
    const v = c.view[node.get](c.pos, le);
    c.pos += node.size;
    return node.isBig ? Number(v) : v;
}
export function readNode(node, c, name, le, ctx, sink) {
    switch (node.kind) {
        case "scalar":
            return readScalar(c, name, node, le);
        case "bits": {
            const raw = readScalar(c, name, node, le);
            const out = {};
            for (const [k, i] of Object.entries(node.positions)) {
                out[k] = (raw >> i) & 1;
            }
            return out;
        }
        case "bitFields": {
            const raw = readScalar(c, name, node, le);
            const out = {};
            let i = 0;
            for (const [k, len] of Object.entries(node.widths)) {
                let val = 0;
                for (let b = 0; b < len; b++, i++)
                    val |= ((raw >> i) & 1) << b;
                out[k] = val;
            }
            return out;
        }
        case "bytes": {
            const n = node.len === "rest"
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
                throw DecodeError.reason(c.where, before, `${name}: 子帧不完整(reader 返回 null), 而本字段声明为单个子帧`);
            }
            return value;
        }
        case "variant":
            throw new Error("readNode: variant 只能作为字段, 不能作为值");
    }
}
function readList(node, c, name, le, ctx, sink) {
    const values = [];
    if (node.len === "rest") {
        while (c.left > 0) {
            if (sink?.stopped)
                break;
            const before = c.pos;
            const value = node.item.kind === "codec"
                ? node.item.read(c, name)
                : readNode(node.item, c, name, le, ctx);
            if (value == null)
                break;
            if (c.pos === before) {
                throw DecodeError.reason(c.where, before, `${name}: 第 ${values.length} 个子帧没有消费任何字节, 会死循环`);
            }
            values.push(value);
        }
        return values;
    }
    if (node.len === "records") {
        const fs = fixedSize(node.item);
        if (fs === undefined) {
            throw new Error(`records("${name}"): 子结构体含变长字段, 无法按定长填到末尾`);
        }
        while (fs > 0 && c.left >= fs) {
            if (sink?.stopped)
                break;
            values.push(readNode(node.item, c, name, le, ctx));
        }
        return values;
    }
    const n = resolveLen(node.len, ctx, c.where, c.pos, name);
    for (let i = 0; i < n; i++) {
        if (sink?.stopped)
            break;
        values.push(readNode(node.item, c, name, le, ctx));
    }
    return values;
}
function pickVariant(node, ctx, where, offset, name, mode) {
    const tag = ctx[node.keyField];
    const key = tag == null ? undefined : node.select ? node.select(tag) : String(tag);
    const fields = key == null ? undefined : node.cases[key];
    if (!fields) {
        const reason = `${name}: ${node.keyField}=${JSON.stringify(tag)} 没有对应分支 (已有: ${Object.keys(node.cases).join(", ") || "无"})`;
        throw mode === "encode"
            ? new EncodeError(where, reason)
            : DecodeError.reason(where, offset, reason);
    }
    return fields;
}
function readField(f, c, out, le, sink) {
    const node = f.node;
    if (node.kind === "skip") {
        c.skip(node.n, f.name);
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
        if (sink?.stopped)
            return;
        const start = c.pos;
        try {
            readField(f, c, out, le, sink);
        }
        catch (e) {
            if (!sink || !(e instanceof DecodeError))
                throw e;
            sink.errors.push(e);
            out[f.name] = undefined;
            c.pos = start;
            const size = fieldFixedSize(f);
            if (size === undefined || size > c.left) {
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
export function decodeStruct(node, c, sink, inheritedLE = false) {
    return readStruct(node, c, inheritedLE, sink);
}
function asList(value) {
    if (value == null)
        return [];
    if (ArrayBuffer.isView(value))
        return Array.from(value);
    return Array.isArray(value) ? value : [value];
}
function toBytes(value, name) {
    if (value == null)
        return new Uint8Array(0);
    if (value instanceof Uint8Array)
        return value;
    throw new EncodeError("encode", `${name}: 期望 Uint8Array, 实际 ${Array.isArray(value) ? "number[]" : typeof value} —— 字节只有一种形态, 文本请自己编码好再传`);
}
function measure(node, value) {
    if (node.kind === "bytes")
        return toBytes(value, "encode").length;
    return asList(value).length;
}
function backfillFields(fields, out, le) {
    for (const f of fields) {
        const node = f.node;
        if (node.kind === "skip")
            continue;
        if ((node.kind === "bytes" || node.kind === "list") &&
            isRef(node.len) &&
            !node.len.transform &&
            out[node.len.field] == null &&
            out[f.name] != null) {
            out[node.len.field] = measure(node, out[f.name]);
        }
        if (node.kind === "struct") {
            out[f.name] = backfillStruct(node, out[f.name], le);
        }
        else if (node.kind === "variant") {
            const branch = pickVariant(node, out, "encode", 0, f.name, "encode");
            backfillFields(branch, out, le);
        }
        else if (node.kind === "list" && node.item.kind === "struct") {
            out[f.name] = asList(out[f.name]).map((it) => backfillStruct(node.item, it, le));
        }
        else if (node.kind === "list" && node.item.kind === "variant") {
            out[f.name] = asList(out[f.name]).map((it) => {
                const v = it == null ? {} : { ...it };
                const branch = pickVariant(node.item, v, "encode", 0, f.name, "encode");
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
export function writeNode(node, w, value, name, le, ctx) {
    switch (node.kind) {
        case "scalar":
            writeScalar(w, node, value ?? 0, le);
            return;
        case "bits": {
            let flags = 0;
            for (const [k, i] of Object.entries(node.positions)) {
                const bit = value?.[k] ?? 0;
                if (bit !== 0 && bit !== 1) {
                    throw new EncodeError("encode", `bits("${k}"): 位只能是 0 或 1, 实际 ${JSON.stringify(bit)}`);
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
                    throw new EncodeError("encode", `bitFields("${k}"): 值 ${JSON.stringify(v)} 放不进 ${len} 位 (0..${2 ** len - 1})`);
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
            const n = typeof node.len === "number"
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
            let n;
            if (node.len === "rest" || node.len === "records") {
                n = items.length;
            }
            else {
                n = resolveLen(node.len, ctx, "encode", w.pos, name);
            }
            if (items.length === 0 && value == null) {
                const fs = fixedSize(node.item);
                if (n > 0 && fs === undefined) {
                    throw new EncodeError("encode", `${name}: 含变长元素, 无法按定长填充`);
                }
                w.zero((fs ?? 0) * n);
                return;
            }
            if (items.length < n) {
                throw new EncodeError("encode", `${name}: 需要 ${n} 个元素(${specText(node.len)}), 实际给了 ${items.length}`);
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
    if (node.kind === "variant") {
        const branch = pickVariant(node, out, "encode", w.pos, f.name, "encode");
        for (const bf of branch)
            writeField(bf, w, out, le);
        return;
    }
    writeNode(node, w, out[f.name], f.name, le, out);
}
export function writeStruct(node, w, value, inheritedLE) {
    const out = backfillStruct(node, value, inheritedLE);
    const le = node.le ?? inheritedLE;
    for (const f of node.fields)
        writeField(f, w, out, le);
}

import { Cursor } from "./cursor";
import { decodeStruct, fixedSize, isRef, readNode, scalarHandle, writeNode, writeStruct, } from "./engine";
import { Writer } from "./writer";
function make(node) {
    const codec = {
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
        },
    };
    return codec;
}
function nodeOf(codec) {
    return codec.node;
}
export function registerType(size, unsigned = true, kind = "int") {
    const h = scalarHandle(size, unsigned, kind);
    const node = {
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
        decode(view, littleEndian = false, offset = 0) {
            const c = new Cursor(view, offset);
            return readNode(node, c, "value", littleEndian, {});
        },
        encode(value, littleEndian = false, offset = 0, view) {
            const w = new Writer({ view, offset, littleEndian });
            writeNode(node, w, value, "value", littleEndian, {});
            return w.finish();
        },
    };
    return codec;
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
export function ref(field, transform) {
    return { __ref: true, field, transform };
}
export { isRef };
export function bytes(len) {
    return make({ kind: "bytes", len });
}
export function rest() {
    return bytes("rest");
}
export function list(item, len) {
    return make({
        kind: "list",
        item: nodeOf(item),
        len,
    });
}
export function records(source, len) {
    const item = nodeOf(source);
    if (len === undefined && fixedSize(item) === undefined) {
        throw new TypeError(`records("${item.name ?? ""}"): 子结构体含变长字段, ` +
            `无法按定长填到末尾 —— 请显式给长度, 或改用 ref/framed`);
    }
    return make({
        kind: "list",
        item,
        len: len ?? "records",
    });
}
function assertBitsStorage(size, kind) {
    if (size !== 1 && size !== 2 && size !== 4) {
        throw new TypeError(`${kind}: 只支持 1/2/4 字节的存储(位运算走 JS 32 位整数), 实际 ${size}`);
    }
}
export function bits(storage, positions) {
    const size = storage.size;
    assertBitsStorage(size, "bits");
    for (const [k, i] of Object.entries(positions)) {
        if (!Number.isInteger(i) || i < 0 || i >= size * 8) {
            throw new TypeError(`bits: 位 "${k}" 的下标 ${i} 越界, 应在 0..${size * 8 - 1}`);
        }
    }
    const h = scalarHandle(size, true, "int");
    return make({
        kind: "bits",
        size,
        ...h,
        positions,
    });
}
export function bitFields(storage, widths) {
    const size = storage.size;
    assertBitsStorage(size, "bitFields");
    let total = 0;
    for (const [k, len] of Object.entries(widths)) {
        if (!Number.isInteger(len) || len < 1) {
            throw new TypeError(`bitFields: 字段 "${k}" 的位宽 ${len} 非法, 应为正整数`);
        }
        total += len;
        if (total > size * 8) {
            throw new TypeError(`bitFields: 位宽总和 ${total} 超过 ${size * 8} 位(字段 "${k}" 越界)`);
        }
    }
    const h = scalarHandle(size, true, "int");
    return make({
        kind: "bitFields",
        size,
        ...h,
        widths,
    });
}
export function skip(n) {
    return make({ kind: "skip", n });
}
function compileFields(def) {
    return Object.entries(def).map(([name, codec]) => ({
        name,
        node: nodeOf(codec),
    }));
}
export function struct(name, def, config) {
    const node = {
        kind: "struct",
        name,
        fields: compileFields(def),
        le: config?.littleEndian,
    };
    const codec = {
        node,
        name,
        struct: def,
        decode(view, littleEndian = false, offset = 0) {
            const c = new Cursor(view, offset, undefined, name);
            return decodeStruct(node, c, undefined, littleEndian);
        },
        decodeLenient(view, littleEndian = false, offset = 0) {
            const c = new Cursor(view, offset, undefined, name);
            const sink = { errors: [], stopped: false };
            const value = decodeStruct(node, c, sink, littleEndian);
            return { value, errors: sink.errors, consumed: c.pos - offset };
        },
        encode(obj, littleEndian = false, offset = 0, view) {
            const w = new Writer({
                view,
                offset,
                littleEndian: config?.littleEndian ?? littleEndian,
            });
            writeStruct(node, w, obj, littleEndian);
            return w.finish();
        },
    };
    return codec;
}
function compileVariantCases(cases) {
    const out = {};
    for (const [k, def] of Object.entries(cases)) {
        out[k] = compileFields(def);
    }
    return out;
}
export function variant(keyField, cases, opts) {
    const node = {
        kind: "variant",
        keyField,
        cases: compileVariantCases(cases),
        select: opts?.select,
    };
    return make(node);
}
function toCodecNode(spec, single) {
    return {
        kind: "codec",
        fixedSize: spec.fixedSize,
        single,
        read: spec.read,
        write: spec.write,
    };
}
export function codec(spec) {
    return make(toCodecNode(spec, false));
}
export function delimited(spec) {
    return make(toCodecNode(spec, true));
}
export function framed(spec) {
    return make({
        kind: "list",
        item: toCodecNode(spec, false),
        len: "rest",
    });
}

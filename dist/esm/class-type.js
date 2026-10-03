import { EncodeError } from "./errors";
import { arrayProxyNext, COUNT, createDataView, isRef, makeDataView, unflattenDeep, } from "./utils";
const intHandle = {
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
const floatHandle = {
    4: "getFloat32",
    8: "getFloat64",
};
function typeHandle(type) {
    const h = type.kind === "float"
        ? floatHandle[type.size]
        : intHandle[type.size]?.[+type.unsigned];
    if (!h) {
        throw new Error(`StructType: 不存在这种字节形状 (size=${type.size}, ` +
            `unsigned=${type.unsigned}, kind=${type.kind})`);
    }
    return [h, h.replace(/^g/, "s"), h.startsWith("getBig")];
}
class StructTypeNext {
    constructor() {
        return arrayProxyNext(this, StructTypeNext);
    }
}
export class StructType extends Array {
    get isList() {
        return !!this.deeps.length;
    }
    get isDynamic() {
        return this.deeps.some((it) => isRef(it));
    }
    get refField() {
        const r = this.deeps.find((it) => isRef(it));
        return r?.field;
    }
    get count() {
        return this.getCount();
    }
    getCount(ctx) {
        if (ctx) {
            const n = ctx[COUNT];
            if (typeof n === "number")
                return n;
        }
        return this.deeps.reduce((acc, it) => {
            let val;
            if (isRef(it)) {
                val = it.resolve(ctx);
            }
            else {
                val = Number(it);
            }
            return acc * val;
        }, 1);
    }
    getDeeps(ctx) {
        return this.deeps.map((it) => {
            if (isRef(it)) {
                return it.resolve(ctx);
            }
            return Number(it);
        });
    }
    getSize(ctx) {
        if (this.isList) {
            return this.size * this.getCount(ctx);
        }
        return this.size;
    }
    get isByteRun() {
        return this.size === 1 && this.unsigned && this.deeps.length === 1;
    }
    constructor(size, unsigned, kind = "int") {
        super();
        this.size = size;
        this.unsigned = unsigned;
        this.kind = kind;
        this.deeps = [];
        if (this.size) {
            const [get, set, isBig] = typeHandle(this);
            this.set = set;
            this.get = get;
            this.isBig = isBig;
        }
        else {
            this.set = this.get = "";
            this.isBig = false;
        }
        return arrayProxyNext(this, StructTypeNext);
    }
    toRaw(value) {
        return this.isBig ? BigInt(value) : value;
    }
    decode(view, littleEndian = false, offset = 0, ctx) {
        view = makeDataView(view);
        if (this.isByteRun) {
            const n = this.getCount(ctx);
            return new Uint8Array(view.buffer, view.byteOffset + offset, n).slice();
        }
        const count = this.getCount(ctx);
        const result = [];
        let i = count;
        while (i--) {
            const v = view[this.get](offset, littleEndian);
            result.push(this.isBig ? Number(v) : v);
            offset += this.size;
        }
        const deeps = this.getDeeps(ctx);
        return this.isList ? unflattenDeep(result, deeps, false) : result[0];
    }
    encode(obj, littleEndian = false, offset = 0, view, ctx) {
        const actualCtx = ctx ?? obj;
        const count = this.getCount(actualCtx);
        const v = createDataView(count * this.size, view);
        if (this.isByteRun && obj != null && !(obj instanceof Uint8Array)) {
            throw new EncodeError("encode", `字节段期望 Uint8Array, 实际 ${Array.isArray(obj) ? "number[]" : typeof obj} —— 字节只有一种形态, 文本请自己编码好再传`);
        }
        if (this.isList && Array.isArray(obj))
            obj = obj.flat(Infinity);
        for (let i = 0; i < count; i++) {
            const it = (this.isList ? obj[i] : obj) ?? 0;
            v[this.set](offset, this.toRaw(it), littleEndian);
            offset += this.size;
        }
        return v;
    }
}
function assertBitsStorage(size, kind) {
    if (size !== 1 && size !== 2 && size !== 4) {
        throw new TypeError(`${kind}: 只支持 1/2/4 字节的存储(位运算走 JS 32 位整数), 实际 ${size}`);
    }
}
export class BitsType extends StructType {
    constructor(size, bits) {
        super(size, true);
        this.bits = bits;
        assertBitsStorage(size, "bits");
        for (const [k, i] of Object.entries(bits)) {
            if (!Number.isInteger(i) || i < 0 || i >= size * 8) {
                throw new TypeError(`bits: 位 "${k}" 的下标 ${i} 越界, 应在 0..${size * 8 - 1}`);
            }
        }
    }
    get isByteRun() {
        return false;
    }
    decode(view, littleEndian = false, offset = 0, ctx) {
        const data = super.decode(view, littleEndian, offset, ctx);
        if (this.isList && Array.isArray(data)) {
            return data.map((it) => {
                const result = {};
                Object.entries(this.bits).forEach(([k, i]) => {
                    result[k] = ((it & (1 << i)) >> i);
                });
                return result;
            });
        }
        else {
            const result = {};
            Object.entries(this.bits).forEach(([k, i]) => {
                result[k] = ((data & (1 << i)) >> i);
            });
            return result;
        }
    }
    encode(obj, littleEndian = false, offset = 0, view, ctx) {
        const actualCtx = ctx ?? obj;
        const count = this.getCount(actualCtx);
        const v = createDataView(count * this.size, view);
        const _getValue = (o) => {
            let flags = 0;
            Object.entries(this.bits).forEach(([k, i]) => {
                const bit = o?.[k] ?? 0;
                if (bit !== 0 && bit !== 1) {
                    throw new EncodeError("encode", `bits("${k}"): 位只能是 0 或 1, 实际 ${JSON.stringify(bit)}`);
                }
                flags |= bit << i;
            });
            return flags;
        };
        if (this.isList && Array.isArray(obj)) {
            for (let i = 0; i < count; i++) {
                v[this.set](offset, this.toRaw(_getValue(obj[i])), littleEndian);
                offset += this.size;
            }
            return v;
        }
        v[this.set](offset, this.toRaw(_getValue(obj)), littleEndian);
        return v;
    }
}
export class BitFieldsType extends StructType {
    constructor(size, bitFields) {
        super(size, true);
        this.bitFields = bitFields;
        assertBitsStorage(size, "bitFields");
        let total = 0;
        for (const [k, len] of Object.entries(bitFields)) {
            if (!Number.isInteger(len) || len < 1) {
                throw new TypeError(`bitFields: 字段 "${k}" 的位宽 ${len} 非法, 应为正整数`);
            }
            total += len;
            if (total > size * 8) {
                throw new TypeError(`bitFields: 位宽总和 ${total} 超过 ${size * 8} 位(字段 "${k}" 越界)`);
            }
        }
    }
    get isByteRun() {
        return false;
    }
    decode(view, littleEndian = false, offset = 0, ctx) {
        const data = super.decode(view, littleEndian, offset, ctx);
        const _unpack = (data) => {
            let i = 0;
            const out = {};
            Object.entries(this.bitFields).forEach(([k, len]) => {
                let val = 0;
                for (let b = 0; b < len; b++, i++)
                    val |= ((data >> i) & 1) << b;
                out[k] = val;
            });
            return out;
        };
        if (this.isList && Array.isArray(data)) {
            return data.map((it) => _unpack(it));
        }
        return _unpack(data);
    }
    encode(obj, littleEndian = false, offset = 0, view, ctx) {
        const actualCtx = ctx ?? obj;
        const count = this.getCount(actualCtx);
        const v = createDataView(count * this.size, view);
        const _getValue = (obj) => {
            let val = 0;
            let shift = 0;
            Object.entries(this.bitFields).forEach(([k, len]) => {
                const v = obj?.[k] ?? 0;
                if (!Number.isInteger(v) || v < 0 || v >= 2 ** len) {
                    throw new EncodeError("encode", `bitFields("${k}"): 值 ${JSON.stringify(v)} 放不进 ${len} 位 (0..${2 ** len - 1})`);
                }
                val |= v << shift;
                shift += len;
            });
            return val;
        };
        if (this.isList && Array.isArray(obj)) {
            for (let i = 0; i < count; i++) {
                v[this.set](offset, this.toRaw(_getValue(obj[i])), littleEndian);
                offset += this.size;
            }
            return v;
        }
        else {
            const val = _getValue(obj);
            v[this.set](offset, this.toRaw(val), littleEndian);
            return v;
        }
    }
}
export function registerType(size, unsigned = true, kind = "int") {
    return new StructType(size, unsigned, kind);
}
export function bits(type, obj) {
    return new BitsType(type.size, obj);
}
export function bitFields(type, obj) {
    return new BitFieldsType(type.size, obj);
}

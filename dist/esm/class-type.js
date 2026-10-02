import { arrayProxyNext, COUNT, createDataView, isRef, makeDataView, unflattenDeep, } from "./utils";
export const FLOAT_TYPE = "float";
export const DOUBLE_TYPE = "double";
const hData = {
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
    f: "getFloat32",
    d: "getFloat64",
};
function typeHandle(type) {
    let h = undefined;
    const isFloat = type.isName(FLOAT_TYPE.toLowerCase()) ||
        type.isName(FLOAT_TYPE.toUpperCase());
    const isDouble = type.isName(DOUBLE_TYPE.toLowerCase()) ||
        type.isName(DOUBLE_TYPE.toUpperCase());
    if (isFloat)
        h = hData["f"];
    if (isDouble)
        h = hData["d"];
    if (!h)
        h = hData[type.size][+type.unsigned];
    if (!h)
        throw new Error(`StructType: Unrecognized ${type} type.`);
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
    isName(typeName) {
        return this.names.includes(typeName);
    }
    constructor(typeName, size, unsigned) {
        super();
        this.size = size;
        this.unsigned = unsigned;
        this.deeps = [];
        this.names = Array.isArray(typeName) ? typeName : [typeName];
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
        if (this.isList && Array.isArray(obj))
            obj = obj.flat();
        for (let i = 0; i < count; i++) {
            const it = (this.isList ? obj[i] : obj) ?? 0;
            v[this.set](offset, this.toRaw(it), littleEndian);
            offset += this.size;
        }
        return v;
    }
}
export class BitsType extends StructType {
    constructor(size, bits) {
        super("<bits>", size, true);
        this.bits = bits;
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
        if (this.isList && Array.isArray(obj)) {
            for (let i = 0; i < count; i++) {
                let flags = 0;
                Object.entries(obj[i]).forEach(([k, v]) => {
                    const i = this.bits[k];
                    if (i !== undefined)
                        flags |= v << i;
                });
                v[this.set](offset, this.toRaw(flags), littleEndian);
                offset += this.size;
            }
            return v;
        }
        else {
            let flags = 0;
            Object.entries(obj).forEach(([k, v]) => {
                const i = this.bits[k];
                if (i !== undefined)
                    flags |= v << i;
            });
            v[this.set](offset, this.toRaw(flags), littleEndian);
            return v;
        }
    }
}
export class BitFieldsType extends StructType {
    constructor(size, bitFields) {
        super("<bit-fields>", size, true);
        this.bitFields = bitFields;
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
            let count = 0;
            Object.entries(this.bitFields).forEach(([k, len]) => {
                const v = obj?.[k] ?? 0;
                val |= v << count;
                count += len;
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
export function registerType(typeName, size, unsigned = true) {
    return new StructType(typeName, size, unsigned);
}
export function typedef(typeName, type) {
    const newType = registerType(typeName, type.size, type.unsigned);
    return newType;
}
export function bits(type, obj) {
    return new BitsType(type.size, obj);
}
export function bitFields(type, obj) {
    return new BitFieldsType(type.size, obj);
}

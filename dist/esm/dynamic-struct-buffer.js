import { StructBuffer, sizeof } from "./struct-buffer";
import { arrayProxyNext, createDataView, createTextDecoder, createTextEncoder, isRef, makeDataView, unflattenDeep, zeroMemory, } from "./utils";
class DynamicStructBufferNext {
    constructor() {
        return arrayProxyNext(this, DynamicStructBufferNext);
    }
}
const KDynamicConfig = {
    textDecode: createTextDecoder(),
    textEncoder: createTextEncoder(),
    littleEndian: undefined,
};
function getFieldCount(type, ctx) {
    if (type.getCount)
        return type.getCount(ctx);
    if (type.count && !isNaN(type.count))
        return type.count;
    if (type.deeps && type.deeps.length) {
        return type.deeps.reduce((acc, it) => {
            const val = isRef(it) ? it.resolve(ctx) : Number(it);
            return acc * val;
        }, 1);
    }
    return 1;
}
function getFieldDeeps(type, ctx) {
    if (type.getDeeps)
        return type.getDeeps(ctx);
    if (type.deeps) {
        return type.deeps.map((it) => (isRef(it) ? it.resolve(ctx) : Number(it)));
    }
    return [];
}
function getStructSingleByteLength(sb) {
    return Object.values(sb.struct).reduce((acc, type) => {
        if (type instanceof StructBuffer)
            return acc + getStructSingleByteLength(type);
        return acc + sizeof(type);
    }, 0);
}
function getBaseStruct(type) {
    let curr = type;
    while (curr && curr.isList && Object.getPrototypeOf(curr)) {
        curr = Object.getPrototypeOf(curr);
    }
    return curr ?? type;
}
export class DynamicStructBuffer extends Array {
    constructor(structName, struct, config) {
        super();
        this.structName = structName;
        this.struct = struct;
        this.deeps = [];
        this.config = Object.assign({}, KDynamicConfig, config);
        this.structKV = Object.entries(struct);
        return arrayProxyNext(this, DynamicStructBufferNext);
    }
    get isList() {
        return !!this.deeps.length;
    }
    get count() {
        return this.getCount();
    }
    getCount(ctx) {
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
    getByteLength(obj, parentCtx) {
        const count = this.getCount(parentCtx ?? obj);
        if (this.isList && Array.isArray(obj)) {
            let total = 0;
            for (let i = 0; i < count; i++) {
                total += this._calcItemByteLength(obj[i]);
            }
            return total;
        }
        return this._calcItemByteLength(obj) * count;
    }
    _calcItemByteLength(item) {
        let size = 0;
        for (const [key, type] of this.structKV) {
            if (type instanceof DynamicStructBuffer) {
                if (type.isList) {
                    const count = getFieldCount(type, item);
                    const val = item ? item[key] : undefined;
                    if (Array.isArray(val)) {
                        for (let j = 0; j < count; j++) {
                            size += type.getByteLength(val[j], item);
                        }
                    }
                    else {
                        size += type.getByteLength(undefined, item) * count;
                    }
                }
                else {
                    size += type.getByteLength(item ? item[key] : undefined, item);
                }
            }
            else if (type instanceof StructBuffer) {
                const singleSize = getStructSingleByteLength(type);
                if (type.isList) {
                    const count = getFieldCount(type, item);
                    size += singleSize * count;
                }
                else {
                    size += singleSize;
                }
            }
            else {
                const structType = type;
                size += structType.getSize(item);
            }
        }
        return size;
    }
    decode(view, littleEndian = false, offset = 0, parentCtx) {
        littleEndian = this.config.littleEndian ?? littleEndian;
        const v = makeDataView(view);
        const result = [];
        const count = this.getCount(parentCtx);
        for (let i = 0; i < count; i++) {
            const item = {};
            for (const [key, type] of this.structKV) {
                if (type instanceof DynamicStructBuffer) {
                    if (type.isList) {
                        const listCount = getFieldCount(type, item);
                        const list = [];
                        for (let j = 0; j < listCount; j++) {
                            const sub = type.decode(v, littleEndian, offset, item);
                            list.push(sub);
                            offset += type.getByteLength(sub, item);
                        }
                        item[key] = unflattenDeep(list, getFieldDeeps(type, item));
                    }
                    else {
                        item[key] = type.decode(v, littleEndian, offset, item);
                        offset += type.getByteLength(item[key], item);
                    }
                }
                else if (type instanceof StructBuffer) {
                    const base = getBaseStruct(type);
                    const singleSize = getStructSingleByteLength(base);
                    if (type.isList) {
                        const listCount = getFieldCount(type, item);
                        const list = [];
                        for (let j = 0; j < listCount; j++) {
                            const sub = base.decode(v, type.config.littleEndian ?? littleEndian, offset);
                            list.push(sub);
                            offset += singleSize;
                        }
                        item[key] = unflattenDeep(list, getFieldDeeps(type, item));
                    }
                    else {
                        item[key] = base.decode(v, type.config.littleEndian ?? littleEndian, offset);
                        offset += singleSize;
                    }
                }
                else {
                    const structType = type;
                    item[key] = structType.decode(v, littleEndian, offset, this.config.textDecode, item);
                    offset += structType.getSize(item);
                }
            }
            result.push(item);
        }
        const deeps = this.getDeeps(parentCtx);
        return (this.isList ? unflattenDeep(result, deeps) : result[0]);
    }
    encode(obj, littleEndian = false, offset = 0, view, parentCtx) {
        littleEndian = this.config.littleEndian ?? littleEndian;
        const count = this.getCount(parentCtx ?? obj);
        let data = obj;
        if (this.isList && Array.isArray(data))
            data = data.flat();
        const prepItem = (it) => {
            if (!it || typeof it !== "object")
                return;
            for (const [key, type] of this.structKV) {
                const refField = type.refField;
                if (refField && it[refField] === undefined) {
                    const val = it[key];
                    if (Array.isArray(val) || typeof val === "string") {
                        it[refField] = val.length;
                    }
                }
            }
        };
        if (this.isList && Array.isArray(data)) {
            for (let i = 0; i < count; i++)
                prepItem(data[i]);
        }
        else {
            prepItem(data);
        }
        const totalSize = this.getByteLength(data, parentCtx);
        let v = createDataView(totalSize, view);
        for (let i = 0; i < count; i++) {
            const it = this.isList ? data[i] : data;
            if (it === undefined) {
                const itemSize = totalSize / count;
                zeroMemory(v, itemSize, offset);
                offset += itemSize;
                continue;
            }
            for (const [key, type] of this.structKV) {
                const val = it[key];
                if (type instanceof DynamicStructBuffer) {
                    if (type.isList) {
                        const listCount = getFieldCount(type, it);
                        const arr = Array.isArray(val) ? val.flat() : [];
                        for (let j = 0; j < listCount; j++) {
                            const subItem = arr[j];
                            v = type.encode(subItem, littleEndian, offset, v, it);
                            offset += type.getByteLength(subItem, it);
                        }
                    }
                    else {
                        v = type.encode(val, littleEndian, offset, v, it);
                        offset += type.getByteLength(val, it);
                    }
                }
                else if (type instanceof StructBuffer) {
                    const base = getBaseStruct(type);
                    const singleSize = getStructSingleByteLength(base);
                    if (type.isList) {
                        const listCount = getFieldCount(type, it);
                        const arr = Array.isArray(val) ? val.flat() : [];
                        for (let j = 0; j < listCount; j++) {
                            const subItem = arr[j];
                            v = base.encode(subItem, type.config.littleEndian ?? littleEndian, offset, v);
                            offset += singleSize;
                        }
                    }
                    else {
                        v = base.encode(val, type.config.littleEndian ?? littleEndian, offset, v);
                        offset += singleSize;
                    }
                }
                else {
                    const structType = type;
                    v = structType.encode(val, littleEndian, offset, v, this.config.textEncoder, it);
                    offset += structType.getSize(it);
                }
            }
        }
        return v;
    }
}

import { arrayNextProxy, arrayProxy, createDataView, makeDataView, unflattenDeep, zeroMemory, } from "./utils";
export function sizeof(type) {
    if (type instanceof StructBuffer) {
        let padidng = 0;
        const maxSize = type.maxSize;
        const size = byteLength(type, 1);
        while ((size + padidng++) % maxSize)
            ;
        return (size + padidng - 1) * type.count;
    }
    return type.isList ? type.size * type.count : type.size;
}
function byteLength(sb, count) {
    const typeByteLength = Object.values(sb.struct).reduce((acc, type) => {
        if (type instanceof StructBuffer)
            acc += type.byteLength;
        else
            acc += sizeof(type);
        return acc;
    }, 0);
    return typeByteLength * (count ?? sb.count);
}
class StructBufferNext {
    constructor(i, structName, struct) {
        this.structName = structName;
        this.struct = struct;
        this.deeps = [];
        this.deeps.push(i);
        return arrayNextProxy(this);
    }
}
export class StructBuffer extends Array {
    constructor(structName, struct) {
        super();
        this.structName = structName;
        this.struct = struct;
        this.deeps = [];
        this.textDecode = new TextDecoder();
        this.textEncoder = new TextEncoder();
        this.structKV = Object.entries(struct);
        return arrayProxy(this, (o, i) => {
            const newProxy = new StructBufferNext(i, o.structName, o.struct);
            newProxy.textDecode = o.textDecode;
            newProxy.textEncoder = o.textEncoder;
            newProxy.structKV = o.structKV;
            Object.setPrototypeOf(newProxy, StructBuffer.prototype);
            return newProxy;
        });
    }
    get isList() {
        return !!this.deeps.length;
    }
    get count() {
        return this.deeps.reduce((acc, it) => (acc *= it), 1);
    }
    get byteLength() {
        return byteLength(this);
    }
    get maxSize() {
        return Math.max(...Object.values(this.struct).map((type) => type instanceof StructBuffer ? type.maxSize : type.size));
    }
    decode(view, littleEndian = false, offset = 0) {
        view = makeDataView(view);
        const result = [];
        let i = this.count;
        while (i--) {
            const data = this.structKV.reduce((acc, [key, type]) => {
                if (type instanceof StructBuffer) {
                    acc[key] = type.decode(view, littleEndian, offset);
                    offset += type.byteLength;
                }
                else {
                    acc[key] = type.decode(view, littleEndian, offset, this.textDecode);
                    offset += sizeof(type);
                }
                return acc;
            }, {});
            result.push(data);
        }
        return this.isList ? unflattenDeep(result, this.deeps) : result[0];
    }
    encode(obj, littleEndian = false, offset = 0, view) {
        const v = createDataView(this.byteLength, view);
        if (this.isList && Array.isArray(obj))
            obj = obj.flat();
        for (let i = 0; i < this.count; i++) {
            const it = this.isList ? obj[i] : obj;
            if (it === undefined) {
                const itemSize = this.byteLength / this.count;
                zeroMemory(v, itemSize, offset);
                offset += itemSize;
                continue;
            }
            this.structKV.reduce((acc, [key, type]) => {
                const value = it[key];
                if (type instanceof StructBuffer) {
                    type.encode(value, littleEndian, offset, acc);
                    offset += type.byteLength;
                }
                else {
                    type.encode(value, littleEndian, offset, acc, this.textEncoder);
                    offset += sizeof(type);
                }
                return acc;
            }, v);
        }
        return v;
    }
}

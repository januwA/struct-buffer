import { Inject } from "./class-type";
import { arrayProxyNext, createDataView, makeDataView, unflattenDeep, zeroMemory, } from "./utils";
export function sizeof(type) {
    if (type instanceof StructBuffer) {
        let padidng = 0;
        const maxSize = type.maxSize;
        const size = byteLength(type, 1);
        while ((size + padidng++) % maxSize)
            ;
        return (size + padidng - 1) * type.count;
    }
    if (type instanceof Inject)
        return type.size;
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
    constructor() {
        return arrayProxyNext(this, StructBufferNext);
    }
}
const KStructBufferConfig = {
    textDecode: new TextDecoder(),
    textEncoder: new TextEncoder(),
    littleEndian: undefined,
};
export class StructBuffer extends Array {
    constructor(structName, struct, config) {
        super();
        this.structName = structName;
        this.struct = struct;
        this.deeps = [];
        this.config = Object.assign({}, KStructBufferConfig);
        Object.assign(this.config, config);
        this.structKV = Object.entries(struct);
        return arrayProxyNext(this, StructBufferNext);
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
        littleEndian = this.config.littleEndian ?? littleEndian;
        view = makeDataView(view);
        const result = [];
        let i = this.count;
        while (i--) {
            const data = this.structKV.reduce((acc, [key, type]) => {
                if (type instanceof StructBuffer) {
                    acc[key] = type.decode(view, type.config.littleEndian ?? littleEndian, offset);
                    offset += type.byteLength;
                }
                else {
                    acc[key] = type.decode(view, littleEndian, offset, this.config.textDecode);
                    offset += sizeof(type);
                }
                return acc;
            }, {});
            result.push(data);
        }
        return this.isList ? unflattenDeep(result, this.deeps) : result[0];
    }
    encode(obj, littleEndian = false, offset = 0, view) {
        littleEndian = this.config.littleEndian ?? littleEndian;
        let v = createDataView(this.byteLength, view);
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
            v = this.structKV.reduce((view, [key, type]) => {
                const value = it[key];
                if (type instanceof StructBuffer) {
                    view = type.encode(value, type.config.littleEndian ?? littleEndian, offset, view);
                    offset += type.byteLength;
                }
                else {
                    view = type.encode(value, littleEndian, offset, view, this.config.textEncoder);
                    offset += sizeof(type);
                }
                return view;
            }, v);
        }
        return v;
    }
}

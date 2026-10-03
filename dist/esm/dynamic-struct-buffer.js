import { Cursor } from "./cursor";
import { Writer } from "./writer";
import { Ctx, flatten, nest, normalizeDef, resolveLengths, runFields, } from "./field";
import { arrayProxyNext, COUNT, isRef } from "./utils";
class DynamicStructBufferNext {
    constructor() {
        return arrayProxyNext(this, DynamicStructBufferNext);
    }
}
const KDynamicConfig = {
    littleEndian: undefined,
};
export class DynamicStructBuffer extends Array {
    constructor(structName, struct, config) {
        super();
        this.structName = structName;
        this.struct = struct;
        this.deeps = [];
        this.config = Object.assign({}, KDynamicConfig, config);
        this.structKV = Object.entries(struct);
        this.def = normalizeDef(struct, structName, this.config.littleEndian ?? false);
        return arrayProxyNext(this, DynamicStructBufferNext);
    }
    get isList() {
        return !!this.deeps.length;
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
            const val = isRef(it) ? it.resolve(ctx) : Number(it);
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
    shapeOf(ctx) {
        return this.getDeeps(ctx).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
    }
    cursor(view, offset, le) {
        return new Cursor(view, offset, undefined, this.structName);
    }
    decode(view, littleEndian = false, offset = 0, parentCtx) {
        void littleEndian;
        const c = this.cursor(view, offset, this.config.littleEndian ?? false);
        const count = this.getCount(parentCtx);
        const root = new Ctx(parentCtx ?? {});
        const values = [];
        for (let i = 0; i < count; i++) {
            const item = {};
            runFields(this.def.fields, c, item, root.child(item, i));
            values.push(item);
        }
        return nest(values, this.shapeOf(parentCtx));
    }
    decodeLenient(view, littleEndian = false, offset = 0, parentCtx) {
        void littleEndian;
        const c = this.cursor(view, offset, this.config.littleEndian ?? false);
        const count = this.getCount(parentCtx);
        const root = new Ctx(parentCtx ?? {});
        const sink = { errors: [], stopped: false };
        const values = [];
        for (let i = 0; i < count; i++) {
            if (sink.stopped)
                break;
            const item = {};
            runFields(this.def.fields, c, item, root.child(item, i), sink);
            values.push(item);
        }
        return {
            value: nest(values, this.shapeOf(parentCtx)),
            errors: sink.errors,
            consumed: c.pos - offset,
        };
    }
    encode(obj, littleEndian = false, offset = 0, view, parentCtx) {
        void littleEndian;
        const w = new Writer({
            view,
            offset,
            littleEndian: this.config.littleEndian ?? false,
        });
        const count = this.getCount(parentCtx ?? obj);
        const items = this.isList ? flatten(obj) : [obj];
        const root = new Ctx(parentCtx ?? {});
        for (let i = 0; i < count; i++) {
            const src = items[i];
            const item = src == null ? {} : { ...src };
            const ctx = resolveLengths(this.def, item);
            const ictx = root.child(ctx, i);
            for (const f of this.def.fields)
                f.encode(w, ctx[f.name], ictx);
        }
        return w.finish();
    }
    getByteLength(obj, parentCtx) {
        if (obj === undefined && this.def.fixedSize !== undefined) {
            return this.def.fixedSize * this.getCount(parentCtx);
        }
        if (obj === undefined) {
            throw new TypeError(`DynamicStructBuffer "${this.structName}" 含变长字段, getByteLength 需要一个样本对象`);
        }
        return this.encode(obj, false, 0, undefined, parentCtx).byteLength;
    }
}

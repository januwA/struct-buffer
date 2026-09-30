import { StringType, StructType } from "./class-type";
import { DecodeError, EncodeError } from "./errors";
import { StructBuffer } from "./struct-buffer";
import { isRef, withCount } from "./utils";
export function isRefSpec(spec) {
    return typeof spec === "object" && "field" in spec;
}
export class Ctx {
    constructor(values, parent, index = 0) {
        this.values = values;
        this.parent = parent;
        this.index = index;
    }
    child(values, index = 0) {
        return new Ctx(values, this, index);
    }
    get root() {
        let c = this;
        while (c.parent)
            c = c.parent;
        return c;
    }
    get valuesFor() {
        return this.values;
    }
    lookup(path, scope = "self") {
        let cur = scope === "self"
            ? this.values
            : scope === "parent"
                ? this.parent?.values
                : this.root.values;
        for (const seg of path.split(".")) {
            if (cur == null)
                return undefined;
            cur = cur[seg];
        }
        return cur;
    }
}
export function resolveCount(spec, ctx, left, site) {
    if (typeof spec === "number")
        return spec;
    if ("until" in spec)
        return left;
    if ("stride" in spec) {
        if (spec.stride <= 0)
            throw new EncodeError(site.where, `${site.field}: stride 必须 > 0`);
        return Math.floor(left / spec.stride);
    }
    if ("product" in spec) {
        return spec.product.reduce((a, sub) => a * resolveCount(sub, ctx, left, site), 1);
    }
    const raw = ctx.lookup(spec.field, spec.scope ?? "self");
    if (raw == null) {
        throw DecodeError.reason(site.where, site.offset, `${site.field}: ref("${spec.field}") 指向的字段尚未解析 —— ` +
            `ref 只能引用同一层里声明在它之前的字段` +
            (spec.scope && spec.scope !== "self" ? ` (scope=${spec.scope})` : ""));
    }
    if (typeof raw !== "number" || !Number.isFinite(raw)) {
        throw DecodeError.reason(site.where, site.offset, `${site.field}: ref("${spec.field}") 取到 ${JSON.stringify(raw)}, 不是有限数字`);
    }
    const n = spec.transform ? spec.transform(raw, ctx.valuesFor) : raw;
    if (!Number.isFinite(n) || n < 0) {
        throw DecodeError.reason(site.where, site.offset, `${site.field}: ref("${spec.field}")${spec.transform ? " 的 transform 之后" : ""}得到 ${n}, 不是非负整数`);
    }
    return n;
}
export function specText(spec) {
    if (typeof spec === "number")
        return String(spec);
    if ("field" in spec)
        return `ref("${spec.field}")`;
    if ("until" in spec)
        return "until:end";
    if ("stride" in spec)
        return `stride:${spec.stride}`;
    return `product(${spec.product.map(specText).join(" * ")})`;
}
export function runFields(fields, c, out, ctx, sink) {
    for (const f of fields) {
        if (sink?.stopped)
            return;
        const start = c.pos;
        try {
            f.decode(c, out, ctx, sink);
        }
        catch (e) {
            if (!sink || !(e instanceof DecodeError))
                throw e;
            sink.errors.push(e);
            out[f.name] = undefined;
            c.pos = start;
            const size = f.fixedSize;
            if (size === undefined || size > c.left) {
                sink.stopped = true;
                return;
            }
            c.pos = start + size;
        }
    }
}
function computeFixedSize(fields) {
    let total = 0;
    for (const f of fields) {
        if (f.fixedSize === undefined)
            return undefined;
        total += f.fixedSize;
    }
    return total;
}
export function nest(values, shape) {
    if (shape.length === 0)
        return values[0];
    if (shape.length === 1)
        return shape[0] === 1 ? values[0] : values;
    const rest = shape.slice(1);
    const stride = rest.reduce((a, b) => a * b, 1);
    const out = [];
    for (let i = 0; i < shape[0]; i++) {
        out.push(nest(values.slice(i * stride, (i + 1) * stride), rest));
    }
    return out;
}
export function flatten(value) {
    if (value == null)
        return [];
    return Array.isArray(value) ? value.flat(Infinity) : [value];
}
function defFixedSize(def, site) {
    if (def.fixedSize === undefined) {
        throw new EncodeError(site.where, `${site.field}: 子结构体 "${def.name}" 含变长字段, 无法按定长填充`);
    }
    return def.fixedSize;
}
export function resolveLengths(def, obj, parent) {
    let out = obj;
    let ctx = new Ctx(out, parent, 0);
    for (const f of def.fields) {
        const next = f.resolveLengths(out, ctx);
        if (next !== out) {
            out = next;
            ctx = new Ctx(out, parent, 0);
        }
    }
    return out;
}
function shapeOf(deeps) {
    return (deeps ?? []).map((d) => (isRef(d) ? -1 : Number(d)));
}
export class TypeField {
    constructor(name, le, type, textDecode, textEncoder) {
        this.name = name;
        this.le = le;
        this.type = type;
        this.textDecode = textDecode;
        this.textEncoder = textEncoder;
        const deeps = type.deeps ?? [];
        this.spec = countOfDeeps(deeps);
        const only = onlyRef(deeps);
        this.refSpec = only ? { field: only.field, transform: only.transform } : undefined;
        if (deeps.length === 0) {
            this.fixedSize = type.size;
        }
        else if (!deeps.some(isRef)) {
            this.fixedSize =
                deeps.reduce((a, d) => a * Number(d), 1) * type.size;
        }
    }
    resolveLengths(obj, ctx) {
        const spec = this.refSpec;
        if (!spec || spec.transform)
            return obj;
        if (obj[spec.field] != null)
            return obj;
        if (obj[this.name] == null)
            return obj;
        return { ...obj, [spec.field]: flatten(obj[this.name]).length };
    }
    decode(c, out, ctx, sink) {
        const site = { where: c.where, field: this.name, offset: c.pos };
        const count = resolveCount(this.spec, ctx, c.left, site);
        const values = withCount(ctx.values, count);
        const size = this.type.getSize(values);
        c.need(size, this.name);
        const start = c.pos;
        out[this.name] = this.type.decode(c.view, this.le, start, this.textDecode, values);
        c.pos = start + size;
    }
    encode(w, value, ctx) {
        const site = { where: "encode", field: this.name, offset: w.pos };
        const count = resolveCount(this.spec, ctx, Infinity, site);
        const values = withCount(ctx.values, count);
        const size = this.type.getSize(values);
        w.reserve(size);
        if (value == null && count > 0) {
            w.zero(size);
            return;
        }
        const before = w.raw;
        const after = this.type.encode(value, this.le, w.pos, before, this.textEncoder, values);
        if (after !== before)
            w.rebind(after);
        w.advance(size);
    }
}
export class SkipField {
    constructor(name, size) {
        this.name = name;
        this.fixedSize = size;
    }
    resolveLengths(obj, ctx) {
        return obj;
    }
    decode(c, out, ctx, sink) {
        c.skip(this.fixedSize, this.name);
    }
    encode(w, value, ctx) {
        w.zero(this.fixedSize);
    }
}
export class BlobField {
    constructor(name, spec, as, textDecoder, textEncoder) {
        this.name = name;
        this.spec = spec;
        this.as = as;
        this.textDecoder = textDecoder;
        this.textEncoder = textEncoder;
        if (typeof spec === "number")
            this.fixedSize = spec;
    }
    encodeValue(value) {
        const enc = this.textEncoder ?? new TextEncoder();
        if (value == null)
            return new Uint8Array(0);
        if (this.as === "text") {
            const items = flatten(value);
            if (items.length === 0)
                return new Uint8Array(0);
            const parts = items.map((v) => enc.encode(String(v)));
            const total = parts.reduce((a, p) => a + p.length, 0);
            const out = new Uint8Array(total);
            let o = 0;
            for (const p of parts) {
                out.set(p, o);
                o += p.length;
            }
            return out;
        }
        if (value instanceof Uint8Array)
            return value;
        if (Array.isArray(value))
            return Uint8Array.from(value);
        if (typeof value === "string")
            return enc.encode(value);
        throw new EncodeError("encode", `${this.name}: 期望 Uint8Array/number[]/string, 实际 ${typeof value}`);
    }
    resolveLengths(obj, ctx) {
        if (!isRefSpec(this.spec) || this.spec.transform)
            return obj;
        if (obj[this.spec.field] != null)
            return obj;
        if (obj[this.name] == null)
            return obj;
        return { ...obj, [this.spec.field]: this.encodeValue(obj[this.name]).length };
    }
    decode(c, out, ctx, sink) {
        const site = { where: c.where, field: this.name, offset: c.pos };
        const n = resolveCount(this.spec, ctx, c.left, site);
        const raw = c.bytes(n, this.name);
        if (this.as !== "text") {
            out[this.name] = raw.slice();
            return;
        }
        const nul = this.fixedSize === undefined ? -1 : raw.indexOf(0);
        const body = nul < 0 ? raw : raw.subarray(0, nul);
        out[this.name] = (this.textDecoder ?? new TextDecoder()).decode(body);
    }
    encode(w, value, ctx) {
        resolveCount(this.spec, ctx, Infinity, {
            where: "encode",
            field: this.name,
            offset: w.pos,
        });
        const bytes = this.encodeValue(value);
        const size = this.fixedSize;
        if (size === undefined) {
            w.bytes(bytes);
            return;
        }
        const out = new Uint8Array(size);
        out.set(bytes.subarray(0, size));
        w.bytes(out);
    }
}
export class StructField {
    constructor(name, def, spec, shape, toEnd = false) {
        this.name = name;
        this.def = def;
        this.spec = spec;
        this.shape = shape;
        this.toEnd = toEnd;
        if (typeof spec === "number" && def.fixedSize !== undefined) {
            this.fixedSize = def.fixedSize * spec;
        }
    }
    resolveLengths(obj, ctx) {
        let out = obj;
        if (isRefSpec(this.spec) &&
            !this.spec.transform &&
            out[this.spec.field] == null &&
            out[this.name] != null) {
            out = { ...out, [this.spec.field]: flatten(out[this.name]).length };
        }
        if (out[this.name] == null)
            return out;
        const items = flatten(out[this.name]);
        let changed = false;
        const resolved = items.map((item) => {
            if (item == null)
                return item;
            const r = resolveLengths(this.def, item, ctx);
            if (r !== item)
                changed = true;
            return r;
        });
        if (!changed)
            return out;
        return {
            ...out,
            [this.name]: this.shape.length === 0
                ? resolved[0]
                : nest(resolved, this.shape),
        };
    }
    decode(c, out, ctx, sink) {
        const site = { where: c.where, field: this.name, offset: c.pos };
        const n = resolveCount(this.spec, ctx, c.left, site);
        const values = [];
        const ic = c.sub(this.name);
        for (let i = 0; i < n; i++) {
            if (sink?.stopped)
                break;
            const item = {};
            runFields(this.def.fields, ic, item, ctx.child(item, i), sink);
            values.push(item);
        }
        out[this.name] = this.toEnd ? values : nest(values, this.shape);
    }
    encode(w, value, ctx) {
        const site = { where: "encode", field: this.name, offset: w.pos };
        const n = this.toEnd ? flatten(value).length : resolveCount(this.spec, ctx, Infinity, site);
        const items = flatten(value);
        if (items.length === 0 && value == null) {
            w.zero(defFixedSize(this.def, site) * n);
            return;
        }
        if (items.length < n) {
            throw new EncodeError("encode", `${this.name}: 需要 ${n} 个元素(${specText(this.spec)}), 实际给了 ${items.length}`);
        }
        for (let i = 0; i < n; i++) {
            const item = items[i];
            if (item == null) {
                w.zero(defFixedSize(this.def, site));
                continue;
            }
            const cctx = ctx.child(item, i);
            for (const f of this.def.fields)
                f.encode(w, item[f.name], cctx);
        }
    }
}
export class VariantField {
    constructor(name, keyField, cases, select) {
        this.name = name;
        this.keyField = keyField;
        this.cases = cases;
        this.select = select;
        this.fixedSize = undefined;
    }
    pick(out, site) {
        const tag = out[this.keyField];
        const key = tag == null ? undefined : this.select ? this.select(tag) : String(tag);
        const def = key == null ? undefined : this.cases[key];
        if (!def) {
            throw DecodeError.reason(site.where, site.offset, `${this.name}: ${this.keyField}=${JSON.stringify(tag)} 没有对应分支 (已有: ${Object.keys(this.cases).join(", ") || "无"})`);
        }
        return def;
    }
    resolveLengths(obj, ctx) {
        return resolveLengths(this.pick(obj, { where: "encode", field: this.name, offset: 0 }), obj, ctx);
    }
    decode(c, out, ctx, sink) {
        const def = this.pick(out, {
            where: c.where,
            field: this.name,
            offset: c.pos,
        });
        runFields(def.fields, c, out, ctx, sink);
    }
    encode(w, value, ctx) {
        void value;
        const def = this.pick(ctx.values, {
            where: "encode",
            field: this.name,
            offset: w.pos,
        });
        for (const f of def.fields)
            f.encode(w, ctx.values[f.name], ctx);
    }
}
export class FramedField {
    constructor(name, reader, writer) {
        this.name = name;
        this.reader = reader;
        this.writer = writer;
        this.fixedSize = undefined;
    }
    resolveLengths(obj, ctx) {
        return obj;
    }
    decode(c, out, ctx, sink) {
        const values = [];
        while (c.left > 0) {
            if (sink?.stopped)
                break;
            const before = c.pos;
            const value = this.reader.read(c, values.length);
            if (value == null)
                break;
            if (c.pos === before) {
                throw DecodeError.reason(c.where, before, `${this.name}: 第 ${values.length} 个子帧没有消费任何字节, 会死循环`);
            }
            values.push(value);
        }
        out[this.name] = values;
    }
    encode(w, value, ctx) {
        const items = flatten(value);
        for (let i = 0; i < items.length; i++)
            this.writer.write(w, items[i], i);
    }
}
export function isDef(x) {
    return !!x && Array.isArray(x.fields);
}
function isDefSource(x) {
    return !!x && !isDef(x) && isDef(x.def);
}
function onlyRef(deeps) {
    if (!deeps || deeps.length !== 1)
        return undefined;
    const d = deeps[0];
    return isRef(d) ? d : undefined;
}
function countOfDeeps(deeps) {
    if (deeps.length === 0)
        return 1;
    const only = onlyRef(deeps);
    if (only)
        return { field: only.field, transform: only.transform };
    if (!deeps.some(isRef)) {
        return deeps.reduce((a, d) => a * Number(d), 1);
    }
    return {
        product: deeps.map((d) => (isRef(d) ? { field: d.field, transform: d.transform } : Number(d))),
    };
}
export function isFieldSpec(x) {
    return !!x && x.__fieldSpec === true;
}
export function normalizeDef(source, name, inheritedLE, codecs) {
    if (isDef(source))
        return source;
    if (isDefSource(source))
        return source.def;
    if (source instanceof StructBuffer) {
        const le = source.config.littleEndian ?? inheritedLE;
        return buildDef(source.struct, name, le, source.config.textDecode ?? codecs?.textDecode, source.config.textEncoder ?? codecs?.textEncoder);
    }
    return buildDef(source, name, inheritedLE, codecs?.textDecode, codecs?.textEncoder);
}
function buildDef(struct, name, le, textDecode, textEncoder) {
    const fields = Object.entries(struct).map(([key, type]) => makeField(key, type, { name: key, parentName: name, le, textDecode, textEncoder }));
    return { name, fields, shape: [], le, fixedSize: computeFixedSize(fields) };
}
function makeField(key, type, bctx) {
    if (isFieldSpec(type))
        return type.build({ ...bctx, name: key });
    if (type instanceof StructBuffer || isDef(type) || isDefSource(type)) {
        const def = normalizeDef(type, `${bctx.parentName}.${key}`, bctx.le, bctx);
        const deeps = type.deeps ?? [];
        return new StructField(key, def, countOfDeeps(deeps), shapeOf(deeps));
    }
    if (type && typeof type === "object" && !(type instanceof StructType)) {
        const def = normalizeDef(type, `${bctx.parentName}.${key}`, bctx.le, bctx);
        return new StructField(key, def, 1, []);
    }
    if (type instanceof StringType) {
        return new BlobField(key, countOfDeeps(type.deeps ?? []), "text", bctx.textDecode, bctx.textEncoder);
    }
    if (type instanceof StructType) {
        return new TypeField(key, bctx.le, type, bctx.textDecode, bctx.textEncoder);
    }
    throw new TypeError(`DynamicStructBuffer: 字段 "${key}" 收到无法识别的类型 ${typeof type}`);
}

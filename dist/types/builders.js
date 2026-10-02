import { BlobField, FramedField, normalizeDef, resolveCount, SkipField, StructField, VariantField, } from "./field";
export function field(build) {
    return { __fieldSpec: true, build };
}
export function skip(n) {
    return field((b) => new SkipField(b.name, n));
}
export function blob(spec) {
    return field((b) => new BlobField(b.name, spec));
}
export function rest() {
    return field((b) => new BlobField(b.name, { until: "end" }));
}
export function records(source, spec) {
    return field((b) => {
        const def = normalizeDef(source, `${b.parentName}.${b.name}`, b.le);
        if (spec !== undefined)
            return new StructField(b.name, def, spec, []);
        if (def.fixedSize === undefined) {
            throw new TypeError(`records("${b.name}"): 子结构体 "${def.name}" 含变长字段, 无法按定长填到末尾` +
                ` —— 请显式给 spec(长度前缀), 或改用 ref/framed`);
        }
        return new StructField(b.name, def, { stride: def.fixedSize }, [], true);
    });
}
export function variant(keyField, cases, opts) {
    return field((b) => {
        const defs = {};
        for (const [k, src] of Object.entries(cases)) {
            defs[k] = normalizeDef(src, `${b.parentName}.${b.name}.${k}`, b.le);
        }
        return new VariantField(b.name, keyField, defs, opts?.select);
    });
}
export function discriminated(name, keyField, keyType, cases) {
    return {
        [keyField]: keyType,
        [name]: variant(keyField, cases),
    };
}
export function framed(reader, writer) {
    return field((b) => new FramedField(b.name, reader, writer));
}
export { resolveCount };
//# sourceMappingURL=builders.js.map
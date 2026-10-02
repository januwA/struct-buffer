import type { ENCODE_VALUE_TYPE, VALUE_TYPE, VARIANT_CASES } from "./class-type";
import type { Def } from "./field";
import type { DynamicStructBuffer } from "./dynamic-struct-buffer";
export type InferType<T> = T extends {
    [VALUE_TYPE]: infer V;
} ? V : InferShape<T>;
export type InferSource<T> = T extends Def ? any : InferShape<T>;
type InferShape<T> = T extends DynamicStructBuffer<any, infer V, any> ? V : T extends object ? {
    [K in keyof T]: InferType<T[K]>;
} : T;
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type Flatten<T> = {
    [K in keyof T]: T[K];
} & {};
type BranchExtras<C> = Partial<UnionToIntersection<{
    [CK in keyof C]: InferType<C[CK]>;
}[keyof C]>>;
type VariantExtras<S> = UnionToIntersection<{
    [K in keyof S]: S[K] extends {
        [VARIANT_CASES]: infer C;
    } ? BranchExtras<C> : {};
}[keyof S]>;
export type InferDef<S> = S extends any ? Flatten<{
    [K in keyof S as InferType<S[K]> extends never ? never : K]: InferType<S[K]>;
} & VariantExtras<S>> : never;
export type InferEncode<T> = T extends {
    [ENCODE_VALUE_TYPE]: infer V;
} ? V : T extends DynamicStructBuffer<any, any, infer V> ? V : InferType<T>;
export type InferEncodeDef<S> = S extends any ? Flatten<{
    [K in keyof S as InferEncode<S[K]> extends never ? never : K]: InferEncode<S[K]>;
} & VariantExtras<S>> : never;
export {};
//# sourceMappingURL=infer.d.ts.map
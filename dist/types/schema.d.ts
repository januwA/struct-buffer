import { Cursor } from "./cursor";
import { isRef, Len, ListOptions, ListSyncOptions, PatternBytes, PatternSource, Ref, SkipUntilOptions, TypeKind } from "./engine";
import { LenientResult } from "./errors";
import { AnyObject, Bit_t, DecodeBuffer_t, TypeSize_t } from "./interfaces";
import { Writer } from "./writer";
export declare const DECODE: unique symbol;
export declare const ENCODE: unique symbol;
export declare const VARIANT_CASES: unique symbol;
export interface Codec<D, E = D> {
    readonly [DECODE]: D;
    readonly [ENCODE]: E;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): D;
    decodeLenient(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): LenientResult<D>;
    encode(value: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
type UnionToIntersection<U> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
type Flatten<T> = {
    [K in keyof T]: T[K];
} & {};
export type InferType<T> = T extends {
    [DECODE]: infer D;
} ? D : T extends object ? {
    [K in keyof T]: InferType<T[K]>;
} : T;
export type InferEncode<T> = T extends {
    [ENCODE]: infer E;
} ? E : InferType<T>;
type BranchExtras<C> = Partial<UnionToIntersection<{
    [CK in keyof C]: InferType<C[CK]>;
}[keyof C]>>;
type VariantExtras<S> = UnionToIntersection<{
    [K in keyof S]: S[K] extends {
        [VARIANT_CASES]: infer C;
    } ? BranchExtras<C> : {};
}[keyof S]>;
type KeyOf<S, K extends keyof S> = S[K] extends {
    [VARIANT_CASES]: any;
} ? never : InferType<S[K]> extends never ? never : K;
export type InferDef<S> = S extends any ? Flatten<{
    [K in keyof S as KeyOf<S, K>]: InferType<S[K]>;
} & VariantExtras<S>> : never;
export type InferEncodeDef<S> = S extends any ? Flatten<{
    [K in keyof S as KeyOf<S, K>]: InferEncode<S[K]>;
} & VariantExtras<S>> : never;
export type InferSource<T> = InferType<T>;
export interface StructBufferConfig {
    littleEndian?: boolean;
}
export interface ScalarCodec<D = number, E = D> extends Codec<D, E> {
    readonly size: number;
    readonly unsigned: boolean;
    readonly kind: TypeKind;
    readonly get: string;
    readonly set: string;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): D;
    encode(value: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare function registerType(size: TypeSize_t, unsigned?: boolean, kind?: TypeKind): ScalarCodec;
export declare const int8_t: ScalarCodec<number, number>;
export declare const int16_t: ScalarCodec<number, number>;
export declare const int32_t: ScalarCodec<number, number>;
export declare const int64_t: ScalarCodec<number, number>;
export declare const uint8_t: ScalarCodec<number, number>;
export declare const uint16_t: ScalarCodec<number, number>;
export declare const uint32_t: ScalarCodec<number, number>;
export declare const uint64_t: ScalarCodec<number, number>;
export declare const float: ScalarCodec<number, number>;
export declare const double: ScalarCodec<number, number>;
export declare function ref(field: string, transform?: (val: number, ctx: AnyObject) => number): Ref;
export { isRef };
export type { Ref, Len, PatternBytes, PatternSource, ListOptions, ListSyncOptions, SkipUntilOptions, };
export declare function bytes(len: number | Ref | "rest"): Codec<Uint8Array, Uint8Array>;
export declare function rest(): Codec<Uint8Array, Uint8Array>;
export declare function list<C extends Codec<any, any>>(item: C, len: number | Ref | "rest", opts?: ListOptions<InferType<C>>): Codec<InferType<C>[], InferEncode<C>[]>;
export declare function records<C extends Codec<any, any>>(source: C, len?: number | Ref): Codec<InferType<C>[], InferEncode<C>[]>;
export declare function bits(storage: ScalarCodec, positions: {
    [k: string]: number;
}): Codec<{
    [x: string]: Bit_t;
}, Partial<{
    [x: string]: Bit_t;
}>>;
export declare function bitFields(storage: ScalarCodec, widths: {
    [k: string]: number;
}): Codec<{
    [x: string]: number;
}, Partial<{
    [x: string]: number;
}>>;
export declare function skip(n: number): Codec<never, never>;
export declare function skipUntil(pattern: PatternSource, opts?: SkipUntilOptions): Codec<never, never>;
export type StructDef = {
    [k: string]: Codec<any, any>;
};
export interface StructCodec<S extends StructDef> extends Codec<InferDef<S>, Partial<InferEncodeDef<S>>> {
    readonly name: string;
    readonly struct: S;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): InferDef<S>;
    decodeLenient(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number): LenientResult<InferDef<S>>;
    encode(obj: Partial<InferEncodeDef<S>>, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare function struct<S extends StructDef>(name: string, def: S, config?: StructBufferConfig): StructCodec<S>;
export interface VariantCodec<C extends {
    [k: string]: StructDef;
}> extends Codec<any, any> {
    readonly [VARIANT_CASES]: C;
}
export declare function variant<C extends {
    [k: string]: StructDef;
}>(keyField: string, cases: C, opts?: {
    select?: (tag: any) => string | undefined;
}): VariantCodec<C>;
export interface CodecSpec<T> {
    fixedSize?: number;
    read: (c: Cursor, name: string) => T | null;
    write: (w: Writer, value: T, name: string) => void;
}
export declare function codec<T>(spec: CodecSpec<T>): Codec<T>;
export declare function delimited<T>(spec: CodecSpec<T>): Codec<T>;
export declare function framed<T>(spec: CodecSpec<T>): Codec<T[]>;
//# sourceMappingURL=schema.d.ts.map
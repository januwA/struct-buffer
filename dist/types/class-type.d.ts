import { Bit_t, DecodeBuffer_t, TypeSize_t } from "./interfaces";
import { Ref } from "./utils";
export type TypeKind = "int" | "float";
export declare const VALUE_TYPE: unique symbol;
export declare const ENCODE_VALUE_TYPE: unique symbol;
export declare const VARIANT_CASES: unique symbol;
export declare class StructType<D, E, Idx = never> extends Array<[
    Idx
] extends [never] ? StructType<D[], E[]> : Idx> {
    size: TypeSize_t;
    readonly unsigned: boolean;
    readonly kind: TypeKind;
    deeps: (number | Ref)[];
    readonly [VALUE_TYPE]: D;
    readonly [ENCODE_VALUE_TYPE]: E;
    get isList(): boolean;
    get isDynamic(): boolean;
    get refField(): string | undefined;
    get count(): number;
    getCount(ctx?: any): number;
    getDeeps(ctx?: any): number[];
    getSize(ctx?: any): number;
    get isByteRun(): boolean;
    get: string;
    set: string;
    readonly isBig: boolean;
    constructor(size: TypeSize_t, unsigned: boolean, kind?: TypeKind);
    protected toRaw(value: any): any;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, ctx?: any): DataView;
}
type BitsType_t = {
    [k: string]: number;
};
export declare class BitsType<D = {
    [key in keyof BitsType_t]: Bit_t;
}, E = Partial<D>> extends StructType<D, E> {
    readonly bits: BitsType_t;
    constructor(size: TypeSize_t, bits: BitsType_t);
    get isByteRun(): boolean;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, ctx?: any): DataView;
}
export declare class BitFieldsType<D = {
    [key in keyof BitsType_t]: number;
}, E = Partial<D>> extends StructType<D, E> {
    readonly bitFields: BitsType_t;
    constructor(size: TypeSize_t, bitFields: BitsType_t);
    get isByteRun(): boolean;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, ctx?: any): DataView;
}
export type ByteListType = StructType<Uint8Array, Uint8Array | number[]>;
export declare function registerType(size: 1, unsigned: true, kind?: "int"): StructType<number, number, ByteListType>;
export declare function registerType<D extends number, E extends number>(size: TypeSize_t, unsigned?: boolean, kind?: TypeKind): StructType<D, E>;
export declare function bits(type: StructType<any, any, any>, obj: BitsType_t): BitsType<{
    [x: string]: Bit_t;
}, Partial<{
    [x: string]: Bit_t;
}>>;
export declare function bitFields(type: StructType<any, any, any>, obj: BitsType_t): BitFieldsType<{
    [x: string]: number;
}, Partial<{
    [x: string]: number;
}>>;
export {};
//# sourceMappingURL=class-type.d.ts.map
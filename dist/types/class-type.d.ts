import { Bit_t, DecodeBuffer_t, InjectNext, TypeSize_t } from "./interfaces";
import { Ref } from "./utils";
export declare const FLOAT_TYPE = "float";
export declare const DOUBLE_TYPE = "double";
export declare const VALUE_TYPE: unique symbol;
export declare const ENCODE_VALUE_TYPE: unique symbol;
export declare const VARIANT_CASES: unique symbol;
export declare class StructType<D, E> extends Array<StructType<D[], E[]>> {
    size: TypeSize_t;
    readonly unsigned: boolean;
    names: string[];
    deeps: (number | Ref)[];
    readonly [VALUE_TYPE]: D;
    get isList(): boolean;
    get isDynamic(): boolean;
    get refField(): string | undefined;
    get count(): number;
    getCount(ctx?: any): number;
    getDeeps(ctx?: any): number[];
    getSize(ctx?: any): number;
    isName(typeName: string): boolean;
    get: string;
    set: string;
    readonly isBig: boolean;
    constructor(typeName: string | string[], size: TypeSize_t, unsigned: boolean);
    protected toRaw(value: any): any;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, textDecodeOrCtx?: any, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, textEncoderOrCtx?: any, ctx?: any): DataView;
}
type BitsType_t = {
    [k: string]: number;
};
export declare class BitsType<D = {
    [key in keyof BitsType_t]: Bit_t;
}, E = Partial<D>> extends StructType<D, E> {
    readonly bits: BitsType_t;
    constructor(size: TypeSize_t, bits: BitsType_t);
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, textDecodeOrCtx?: any, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, textEncoderOrCtx?: any, ctx?: any): DataView;
}
export declare class BitFieldsType<D = {
    [key in keyof BitsType_t]: number;
}, E = Partial<D>> extends StructType<D, E> {
    readonly bitFields: BitsType_t;
    constructor(size: TypeSize_t, bitFields: BitsType_t);
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, textDecodeOrCtx?: any, ctx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, textEncoderOrCtx?: any, ctx?: any): DataView;
}
export declare class StringType extends StructType<string, string> {
    constructor();
    textDecode: TextDecoder;
    textEncoder: TextEncoder;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, textDecode?: TextDecoder, ctx?: any): any;
    encode(obj: string, littleEndian?: boolean, offset?: number, view?: DataView, textEncoder?: TextEncoder, ctx?: any): DataView;
}
type HInjectDecode = (view: DataView, offset: number) => InjectNext;
type HInjectEncode = (value: any) => DecodeBuffer_t;
export declare class Inject extends StructType<any, any> {
    private hInjectDecode?;
    private hInjectEncode?;
    constructor(hInjectDecode?: HInjectDecode | undefined, hInjectEncode?: HInjectEncode | undefined);
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, textDecodeOrCtx?: any, ctx?: any): any;
    encode(obj: any, littleEndian?: boolean, offset?: number, view?: DataView, textEncoderOrCtx?: any, ctx?: any): DataView;
}
export declare function registerType<D extends number, E extends number>(typeName: string | string[], size: TypeSize_t, unsigned?: boolean): StructType<D, E>;
export declare function typedef<D extends number, E extends number>(typeName: string | string[], type: StructType<any, any>): StructType<D, E>;
export declare function bits(type: StructType<number, number>, obj: BitsType_t): BitsType<{
    [x: string]: Bit_t;
}, Partial<{
    [x: string]: Bit_t;
}>>;
export declare function bitFields(type: StructType<number, number>, obj: BitsType_t): BitFieldsType<{
    [x: string]: number;
}, Partial<{
    [x: string]: number;
}>>;
export {};
//# sourceMappingURL=class-type.d.ts.map
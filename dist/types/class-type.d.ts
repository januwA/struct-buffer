import { TypeSize_t } from "./interfaces";
export declare const FLOAT_TYPE = "float";
export declare const DOUBLE_TYPE = "double";
export declare class StructType<D, E> extends Array<StructType<D[], E[]>> {
    readonly size: TypeSize_t;
    readonly unsigned: boolean;
    names: string[];
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    is<D, E>(type: StructType<D, E>): boolean;
    isName(typeName: string): boolean;
    get: string;
    set: string;
    constructor(typeName: string | string[], size: TypeSize_t, unsigned: boolean);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
declare type BitsType_t = {
    [k: string]: number;
};
export declare class BitsType<D = {
    [key in keyof BitsType_t]: 1 | 0;
}, E = Partial<D>> extends StructType<D, E> {
    readonly bits: BitsType_t;
    constructor(size: TypeSize_t, bits: BitsType_t);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare class BoolType<D extends boolean, E extends boolean | number> extends StructType<D, E> {
    constructor(typeName: string | string[], type: StructType<number, number>);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare class StringType extends StructType<string, string> {
    constructor();
    textDecode: TextDecoder;
    textEncoder: TextEncoder;
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number, textDecode?: TextDecoder): any;
    encode(obj: string, littleEndian?: boolean, offset?: number, view?: DataView, textEncoder?: TextEncoder): DataView;
}
export declare class PaddingType extends StructType<number, number> {
    constructor();
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): any;
    encode(zero?: number, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare function registerType<D extends number, E extends number>(typeName: string | string[], size: TypeSize_t, unsigned?: boolean): StructType<D, E>;
export declare function typedef<D extends number, E extends number>(typeName: string | string[], type: StructType<any, any>): StructType<D, E>;
export declare function bits(type: StructType<number, number>, obj: BitsType_t): BitsType<{
    [x: string]: 0 | 1;
}, Partial<{
    [x: string]: 0 | 1;
}>>;
export {};
//# sourceMappingURL=class-type.d.ts.map
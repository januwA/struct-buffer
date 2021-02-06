import { Type } from "./interfaces";
export declare const FLOAT_TYPE = "float";
export declare const DOUBLE_TYPE = "double";
export declare class StructType<D, E> extends Array<StructType<D[], E[]>> {
    readonly size: 1 | 2 | 4 | 8;
    readonly unsigned: boolean;
    private readonly KlassType?;
    names: string[];
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    is<D, E>(type: StructType<D, E>): boolean;
    isName(typeName: string): boolean;
    get: string;
    set: string;
    constructor(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned: boolean, KlassType?: Type<StructType<any, any>> | undefined);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
interface IBitsType {
    [k: string]: number;
}
export declare class BitsType<T extends IBitsType, D = {
    [key in keyof T]: 1 | 0;
}, E = {
    [key in keyof T]?: 1 | 0;
}> extends StructType<D, E> {
    readonly bits: T;
    constructor(size: 2 | 1 | 4 | 8, bits: T);
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
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number, textDecode?: TextDecoder): any;
    encode(obj: string, littleEndian?: boolean, offset?: number, view?: DataView, textEncoder?: TextEncoder): DataView;
}
export declare class PaddingType extends StructType<number, number> {
    constructor();
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): any;
    encode(zero?: number, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare function registerType<D extends number, E extends number>(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned?: boolean): StructType<D, E>;
export declare function typedef<D extends number, E extends number>(typeName: string | string[], type: StructType<any, any>): StructType<D, E>;
export declare function bits<T extends IBitsType>(type: StructType<number, number>, obj: T): BitsType<T, { [key in keyof T]: 0 | 1; }, { [key_1 in keyof T]?: 0 | 1 | undefined; }>;
export {};
//# sourceMappingURL=class-type.d.ts.map
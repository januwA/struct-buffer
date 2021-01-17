import { AnyObject } from "./interfaces";
export declare const FLOAT_TYPE = "float";
export declare const DOUBLE_TYPE = "double";
export declare const STRING_TYPE = "string_t";
export declare class StructType extends Array<StructType> {
    readonly size: 1 | 2 | 4 | 8;
    readonly unsigned: boolean;
    names: string[];
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    is(type: StructType): boolean;
    isName(typeName: string): boolean;
    get: string;
    set: string;
    constructor(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned: boolean);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number, textDecode?: TextDecoder): any;
    encode(obj: any, littleEndian?: boolean, offset?: number, view?: DataView, textEncoder?: TextEncoder): DataView;
}
export declare class BitsType<T extends AnyObject> extends StructType {
    readonly bits: T;
    constructor(size: 2 | 1 | 4 | 8, bits: T);
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): {
        [key in keyof T]?: 1 | 0;
    };
    encode(obj: {
        [key: string]: 1 | 0;
    }, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export declare function registerType(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned?: boolean): StructType;
export declare function typedef(typeName: string | string[], type: StructType): StructType;
interface IBitsType {
    [k: string]: number;
}
export declare function bits<T extends IBitsType>(type: StructType, obj: T): BitsType<T>;
export {};

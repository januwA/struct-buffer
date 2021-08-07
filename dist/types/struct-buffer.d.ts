import { StructType } from "./class-type";
export declare type Type_t = StructType<any, any> | StructBuffer;
export declare type StructBuffer_t = {
    [k: string]: Type_t;
};
export declare function sizeof(type: Type_t): number;
declare type StructBufferConfig = {
    textDecode?: TextDecoder;
    textEncoder?: TextEncoder;
    littleEndian?: boolean;
};
export declare class StructBuffer<D = {
    [k in keyof StructBuffer_t]: any;
}, E = Partial<D>> extends Array<StructBuffer<D[], E[]>> {
    structName: string;
    struct: StructBuffer_t;
    deeps: number[];
    config: StructBufferConfig;
    structKV: [string, Type_t][];
    constructor(structName: string, struct: StructBuffer_t, config?: StructBufferConfig);
    get isList(): boolean;
    get count(): number;
    get byteLength(): number;
    get maxSize(): number;
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
export {};
//# sourceMappingURL=struct-buffer.d.ts.map
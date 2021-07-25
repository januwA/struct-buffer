import { StructType } from "./class-type";
export declare function sizeof(type: StructType<any, any> | StructBuffer<IStructBuffer>): number;
export interface IStructBuffer {
    [k: string]: StructType<any, any> | StructBuffer<IStructBuffer>;
}
export declare class StructBuffer<T extends IStructBuffer, D = {
    [k in keyof T]: any;
}, E = {
    [k in keyof T]?: any;
}> extends Array<StructBuffer<T, D[], E[]>> {
    readonly structName: string;
    readonly struct: T;
    deeps: number[];
    textDecode: TextDecoder;
    textEncoder: TextEncoder;
    structKV: [string, StructType<any, any> | StructBuffer<IStructBuffer>][];
    get isList(): boolean;
    get count(): number;
    constructor(structName: string, struct: T);
    get byteLength(): number;
    get maxSize(): number;
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
//# sourceMappingURL=struct-buffer.d.ts.map
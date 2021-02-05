import { StructType } from "./class-type";
import { AnyObject } from "./interfaces";
export declare function sizeof(type: StructType<any, any> | StructBuffer<AnyObject>): number;
export interface IStructBuffer {
    [k: string]: StructType<any, any> | StructBuffer<IStructBuffer>;
}
export declare class StructBuffer<T extends IStructBuffer> extends Array<StructBuffer<T>> {
    readonly structName: string;
    readonly struct: T;
    deeps: number[];
    textDecode: TextDecoder;
    textEncoder: TextEncoder;
    structKV: [string, StructType<any, any> | StructBuffer<AnyObject>][];
    get isList(): boolean;
    get count(): number;
    constructor(structName: string, struct: T);
    get byteLength(): number;
    get maxSize(): number;
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): {
        [k in keyof T]: any;
    };
    encode(obj: {
        [k in keyof T]: any;
    } | {
        [k in keyof T]: any;
    }[], littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
//# sourceMappingURL=struct-buffer.d.ts.map
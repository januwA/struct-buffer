import { StructType } from "./class-type";
import { AnyObject } from "./interfaces";
export declare function sizeof(type: StructType | StructBuffer): number;
export declare class StructBuffer extends Array<StructBuffer> {
    readonly structName: string;
    readonly struct: {
        [k: string]: StructType | StructBuffer;
    };
    deeps: number[];
    textDecode: TextDecoder;
    textEncoder: TextEncoder;
    structKV: [string, StructType | StructBuffer][];
    get isList(): boolean;
    get count(): number;
    constructor(structName: string, struct: {
        [k: string]: StructType | StructBuffer;
    });
    get byteLength(): number;
    get maxSize(): number;
    decode(view: ArrayBufferView | number[], littleEndian?: boolean, offset?: number): AnyObject;
    encode(obj: AnyObject, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}

import { StructType } from "./class-type";
import { AnyObject, DysplayResult } from "./interfaces";
export declare function sizeof(type: StructType | StructBuffer): number;
export declare function display(view: DataView, type: StructType, isHex?: boolean, littleEndian?: boolean): DysplayResult[];
export declare class StructBuffer extends Array {
    readonly structName: string;
    readonly struct: {
        [k: string]: StructType | StructBuffer;
    };
    i?: number;
    private _textDecode;
    private _textEncoder;
    get isList(): boolean;
    get count(): number;
    constructor(structName: string, struct: {
        [k: string]: StructType | StructBuffer;
    });
    get textDecode(): TextDecoder;
    set textDecode(value: TextDecoder);
    private _decode;
    get textEncoder(): TextEncoder;
    set textEncoder(value: TextEncoder);
    private _encode;
    get byteLength(): number;
    get maxSize(): number;
    decode(view: ArrayBufferView, littleEndian?: boolean, offset?: number): AnyObject;
    encode(obj: AnyObject, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
    toCStruct(): string;
}
//# sourceMappingURL=struct-buffer.d.ts.map
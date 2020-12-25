import { StructType } from "./class-type";
import { AnyObject, DysplayResult } from "./interfaces";
export declare function sizeof(type: StructType | StructBuffer): number;
export declare function display(view: DataView, type: StructType, isHex?: boolean, littleEndian?: boolean): DysplayResult[];
export declare class StructBuffer {
    private readonly struct;
    constructor(struct: {
        [k: string]: StructType | StructBuffer;
    });
    private _textDecode;
    get textDecode(): TextDecoder;
    set textDecode(value: TextDecoder);
    private _decode;
    private _textEncoder;
    get textEncoder(): TextEncoder;
    set textEncoder(value: TextEncoder);
    private _encode;
    get byteLength(): number;
    decode(view: ArrayBufferView, littleEndian?: boolean, offset?: number): AnyObject;
    encode(obj: AnyObject, littleEndian?: boolean, offset?: number, view?: DataView): DataView;
}
//# sourceMappingURL=struct-buffer.d.ts.map
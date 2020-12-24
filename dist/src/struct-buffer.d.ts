import { StructType } from "./class-type";
import { AnyObject, DysplayResult, StructOption, TypeHandleOptions } from "./interfaces";
export declare function typeHandle(type: StructType, options: TypeHandleOptions): void;
export declare function sizeof(type: StructType): number;
export declare function display(view: DataView, type: StructType, isHex?: boolean, littleEndian?: boolean): DysplayResult[];
export declare class StructBuffer {
    private readonly struct;
    private _textDecode;
    get textDecode(): TextDecoder;
    set textDecode(value: TextDecoder);
    private _decode;
    private _textEncoder;
    get textEncoder(): TextEncoder;
    set textEncoder(value: TextEncoder);
    private _encode;
    constructor(struct: StructOption);
    private _offset;
    get byteLength(): number;
    decode(view: DataView, littleEndian?: boolean): AnyObject;
    encode(obj: AnyObject, littleEndian?: boolean): DataView;
    private _readBytes;
    private _writeBytes;
    private _readValue;
    private _writeValue;
}
//# sourceMappingURL=struct-buffer.d.ts.map
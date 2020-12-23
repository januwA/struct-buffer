export interface AnyObject {
    [key: string]: any;
}
export interface StructOption {
    [k: string]: string;
}
export declare class StructBuffer {
    private readonly struct;
    private _textDecode;
    get textDecode(): TextDecoder;
    set textDecode(value: TextDecoder);
    private _textEncoder;
    get textEncoder(): TextEncoder;
    set textEncoder(value: TextEncoder);
    constructor(struct: StructOption);
    private _offset;
    get byteLength(): number;
    decode(view: DataView, littleEndian?: boolean): AnyObject;
    encode(obj: AnyObject, littleEndian?: boolean): DataView;
    private _readBytes;
    private _writeBytes;
}
//# sourceMappingURL=struct-buffer.d.ts.map
import { DecodeBuffer_t, ITextDecoder, ITextEncoder } from "./interfaces";
export declare function zeroMemory(view: DataView, length: number, offset: number): void;
export declare function createDataView(byteLength: number, view?: DataView): DataView<ArrayBufferLike>;
export declare function makeDataView(view: DecodeBuffer_t): DataView;
export declare function sbytes(str: string): DataView;
export declare function sbytes2(str: string, encoder?: ITextEncoder): DataView;
export declare function sview(view: DecodeBuffer_t): string;
export declare function TEXT(buf: number[] | ArrayBufferView, decoder: ITextDecoder, placeholder?: ((byte: number) => string) | string): string;
//# sourceMappingURL=utils.d.ts.map
import { DecodeBuffer_t } from "./interfaces";
export declare function zeroMemory(view: DataView, length: number, offset: number): void;
export declare function createDataView(byteLength: number, view?: DataView): DataView;
export declare function makeDataView(view: DecodeBuffer_t): DataView;
export declare function sbytes(str: string): DataView;
export declare function createTextDecoder(): TextDecoder;
export declare function createTextEncoder(): TextEncoder;
export declare function sbytes2(str: string, te?: TextEncoder): DataView;
export declare function sview(view: DecodeBuffer_t): string;
export declare function TEXT(buf: number[] | ArrayBufferView, placeholder?: ((byte: number) => string) | string): string;
export declare function TEXT(buf: number[] | ArrayBufferView, text?: TextDecoder, placeholder?: ((byte: number) => string) | string): string;
//# sourceMappingURL=utils.d.ts.map
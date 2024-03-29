import { DecodeBuffer_t, Type } from "./interfaces";
export declare function unflattenDeep(array: any[] | string, deeps: number[], isString?: boolean): any;
export declare function zeroMemory(view: DataView, length: number, offset: number): void;
export declare function createDataView(byteLength: number, view?: DataView): DataView;
export declare function makeDataView(view: DecodeBuffer_t): DataView;
export declare function arrayProxy(context: any, cb: (target: any, index: number) => any): any;
export declare function arrayProxyNext(context: any, klass: Type<any>): any;
export declare function sbytes(str: string): DataView;
export declare function sbytes2(str: string, te?: TextEncoder): DataView;
export declare function sview(view: DecodeBuffer_t): string;
export declare function TEXT(buf: number[] | ArrayBufferView, placeholder?: ((byte: number) => string) | string): string;
export declare function TEXT(buf: number[] | ArrayBufferView, text?: TextDecoder, placeholder?: ((byte: number) => string) | string): string;
export declare function realloc(mem: DecodeBuffer_t, size: number, pushMem?: DecodeBuffer_t, pushOffset?: number): DataView;
//# sourceMappingURL=utils.d.ts.map
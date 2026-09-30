import { DecodeBuffer_t, Type } from "./interfaces";
export declare function unflattenDeep(array: any[] | string, deeps: (number | any)[], isString?: boolean): any;
export declare function zeroMemory(view: DataView, length: number, offset: number): void;
export declare function createDataView(byteLength: number, view?: DataView): DataView;
export declare function makeDataView(view: DecodeBuffer_t): DataView;
export declare const COUNT: unique symbol;
export declare function withCount(ctx: any, count: number): any;
export declare class Ref {
    readonly field: string;
    readonly transform?: ((val: number, ctx: any) => number) | undefined;
    readonly __isRef = true;
    readonly id: string;
    constructor(field: string, transform?: ((val: number, ctx: any) => number) | undefined);
    resolve(ctx: any): number;
    [Symbol.toPrimitive](): string;
    toString(): string;
}
export declare function isRef(v: any): v is Ref;
declare const REF_INDEX: unique symbol;
export type RefIndex = number & {
    readonly [REF_INDEX]?: Ref;
};
export declare function ref(field: string, transform?: (val: number, ctx: any) => number): RefIndex;
export declare function arrayProxy(context: any, cb: (target: any, index: any) => any): any;
export declare function arrayProxyNext(context: any, klass: Type<any>): any;
export declare function sbytes(str: string): DataView;
export declare function createTextDecoder(): TextDecoder;
export declare function createTextEncoder(): TextEncoder;
export declare function sbytes2(str: string, te?: TextEncoder): DataView;
export declare function sview(view: DecodeBuffer_t): string;
export declare function TEXT(buf: number[] | ArrayBufferView, placeholder?: ((byte: number) => string) | string): string;
export declare function TEXT(buf: number[] | ArrayBufferView, text?: TextDecoder, placeholder?: ((byte: number) => string) | string): string;
export declare function realloc(mem: DecodeBuffer_t, size: number, pushMem?: DecodeBuffer_t, pushOffset?: number): DataView;
export {};
//# sourceMappingURL=utils.d.ts.map
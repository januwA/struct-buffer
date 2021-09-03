export interface AnyObject {
    [key: string]: any;
    [index: number]: any;
}
export interface Type<T extends Object> extends Function {
    new (...args: any[]): T;
}
export interface DysplayResult {
    offset: number;
    value: any;
}
export declare type TypeSize_t = 1 | 2 | 4 | 8;
export declare type Bit_t = 0 | 1;
export declare type DecodeBuffer_t = ArrayBufferView | number[];
//# sourceMappingURL=interfaces.d.ts.map
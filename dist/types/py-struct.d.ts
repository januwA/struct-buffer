export declare function pack(format: string, ...args: any[]): DataView;
export declare function pack_into(format: string, buffer: ArrayBufferView | number[], offset: number, ...args: any[]): DataView;
export declare function unpack(format: string, buffer: ArrayBufferView | number[], offset?: number): any[];
export declare function unpack_from(format: string, buffer: ArrayBufferView | number[], offset?: number): any[];
export declare function iter_unpack(format: string, buffer: number[] | ArrayBufferView): {
    next(): {
        value: any[];
        done: boolean;
    } | {
        value: null;
        done: boolean;
    };
    [Symbol.iterator](): any;
};
export declare function calcsize(format: string): number;
export declare class Struct {
    readonly format: string;
    size: number;
    constructor(format: string);
    pack(...args: any[]): DataView;
    pack_into(buffer: ArrayBufferView | number[], offset: number, ...args: any[]): DataView;
    unpack(buffer: ArrayBufferView | number[], offset?: number): any[];
    unpack_from(buffer: ArrayBufferView | number[], offset?: number): any[];
    iter_unpack(buffer: ArrayBufferView | number[]): {
        next(): {
            value: any[];
            done: boolean;
        } | {
            value: null;
            done: boolean;
        };
        [Symbol.iterator](): any;
    };
}
//# sourceMappingURL=py-struct.d.ts.map
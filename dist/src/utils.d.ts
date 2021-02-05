export declare function unflattenDeep(array: any[] | string, deeps: number[], isString?: boolean): any;
export declare function zeroMemory(view: DataView, length: number, offset: number): void;
export declare function createDataView(byteLength: number, view?: DataView): DataView;
export declare function makeDataView(view: ArrayBufferView | number[]): DataView;
export declare function arrayProxy(context: any, cb: (target: any, index: number) => any): any;
export declare function arrayNextProxy(context: any): any;
export declare function sbytes(str: string): DataView;
export declare function sview(view: ArrayBufferView | number[]): string;
//# sourceMappingURL=utils.d.ts.map
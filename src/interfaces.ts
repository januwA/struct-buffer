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

export type TypeSize_t = 1 | 2 | 4 | 8;

export type Bit_t = 0 | 1;

export type DecodeBuffer_t = ArrayBufferView | number[];

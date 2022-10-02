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

export interface InjectNext {
  /**
   * how many bytes are consumed
   */
  size: number;

  /**
   * parsed result
   */
  value: any;
}

export type TypeSize_t = number;

export type Bit_t = 0 | 1;

export type DecodeBuffer_t = ArrayBufferView | number[];

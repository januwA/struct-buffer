export interface AnyObject {
  [key: string]: any;
  [index: number]: any;
}

export interface DisplayResult {
  offset: number;
  value: any;
}

export type TypeSize_t = number;

export type Bit_t = 0 | 1;

export type DecodeBuffer_t = ArrayBufferView | number[];

export interface ITextEncoder {
  encode(input: string): Uint8Array;
}

export interface ITextDecoder {
  decode(input?: ArrayBuffer | ArrayBufferView): string;
}

import { AbstractDeep } from "./abstract";

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

export type Bit_t = 0 | 1;

export type DecodeBuffer_t = ArrayBufferView | number[];

export interface IByteLength {
  get byteLength(): number;
}

export interface IDecodeOptions {
  offset?: number;
  littleEndian?: boolean;
}

export interface IDecode<D> {
  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D;
}

export interface IEncodeOptions {
  /**
   * 记录偏移量
   */
  offset?: number;

  /**
   * littleEndian参数用于DataView类型get和set方法时使用
   */
  littleEndian?: boolean;

  view?: DataView;
}

export interface IEncode<E extends any> {
  encode(obj: E, options?: IEncodeOptions): DataView;
}

export interface IType {
  size: number;
  unsigned: boolean;
  isName(typeName: string): boolean;
}

export type DataViewGet_t = Extract<keyof DataView, `get${string}`>;
export type DataViewSet_t = Extract<keyof DataView, `set${string}`>;
export type DataViewSetExcludeBig_t = Exclude<DataViewSet_t, `setBig${string}`>;
export type DataViewSetBig_t = Extract<DataViewSet_t, `setBig${string}`>;

export type BufferLike_t = AbstractDeep<any> &
  IByteLength &
  IDecode<any> &
  IEncode<any>;

export type StructBuffer_t = { [k: string]: BufferLike_t };

export type BitsType_t = { [k: string]: number };

export type HInjectDecode = (view: DataView, offset: number) => InjectNext;
export type HInjectEncode = (value: any) => DecodeBuffer_t;

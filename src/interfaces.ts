export interface AnyObject {
  [key: string]: any;
  [index: number]: any;
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

export type LikeBuffer_t = ArrayBufferView | number[];

export interface IByteLength {
  byteLength: number;
}

export interface IDecodeOptions {
  offset?: number;
  littleEndian?: boolean;
}

export interface IDecode<D> {
  decode(view: LikeBuffer_t, options?: IDecodeOptions): D;
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
  get isFloat(): boolean;
  get isDouble(): boolean;
}

export type DataViewGet_t = Extract<keyof DataView, `get${string}`>;
export type DataViewSet_t = Extract<keyof DataView, `set${string}`>;
export type DataViewSetExcludeBig_t = Exclude<DataViewSet_t, `setBig${string}`>;
export type DataViewSetBig_t = Extract<DataViewSet_t, `setBig${string}`>;

export interface IBufferLike<D, E>
  extends ArrayLike<any>,
    IByteLength,
    IDecode<D>,
    IEncode<E> {}

export type StructBuffer_t = { [k: string]: IBufferLike<any, any> };

export type NumberMap_t = { [k: string]: number };

export type InjectDecode_t = (view: DataView, offset: number) => InjectNext;
export type InjectEncode_t = (value: any) => LikeBuffer_t;

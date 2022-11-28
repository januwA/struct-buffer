import {
  LikeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
} from "../interfaces";
import RuntimeType from "./RuntimeType";

export class Defer<D, E> extends RuntimeType<D, E> {
  constructor(private readonly bufferLikeFactory: () => IBufferLike<D, E>) {
    super();
  }

  private _bufferLike?: IBufferLike<D, E>;
  private get bufferLike(): IBufferLike<D, E> {
    this._bufferLike ??= this.isList
      ? this.bufferLikeFactory()[this.length]
      : this.bufferLikeFactory();
    return this._bufferLike!;
  }

  decode(view: LikeBuffer_t, options?: IDecodeOptions) {
    return this.bufferLike.decode(view, options);
  }

  encode(obj: any, options?: IEncodeOptions): DataView {
    return this.bufferLike.encode(obj, options);
  }

  override get byteLength(): number {
    return this.bufferLike.byteLength;
  }
}

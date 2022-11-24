import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
} from "../interfaces";
import BufferLikeDecorator from "./BufferLikeDecorator";

export class LittleEndian<D, E> extends BufferLikeDecorator<D, E> {
  override next(i: number) {
    const next = super.next(i);
    (next as any).src = this.src[i];
    return next;
  }

  constructor(src: IBufferLike<D, E>, private readonly littleEndian = true) {
    super(src);
  }

  private optionsWithLittleEndian(options?: IEncodeOptions): IEncodeOptions {
    return Object.assign({}, options, {
      littleEndian: this.littleEndian,
    });
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    return super.encode(obj, this.optionsWithLittleEndian(options));
  }
  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    return super.decode(view, this.optionsWithLittleEndian(options));
  }
}
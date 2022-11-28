import { createDataView } from "../utils";
import {
  LikeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
} from "../interfaces";
import BufferLikeDecorator from "./BufferLikeDecorator";

export class RelativeOffset<D, E> extends BufferLikeDecorator<D, E> {
  constructor(src: IBufferLike<D, E>, private readonly relativeOffset = 0) {
    super(src);
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const newOptions = Object.assign({}, options, {
      offset: options?.offset ?? 0,
      view: createDataView(this.byteLength, options?.view),
    });

    this.each(obj, (it) => {
      newOptions.offset += this.relativeOffset;
      newOptions.view = super.encode(it, newOptions);
      newOptions.offset += super.byteLength;
    });

    return newOptions.view!;
  }

  override decode(view: LikeBuffer_t, options?: IDecodeOptions): D {
    const newOptions = Object.assign({}, options, {
      offset: options?.offset ?? 0,
    });

    return this.resultEach([], () => {
      newOptions.offset += this.relativeOffset;
      const res = super.decode(view, newOptions);
      newOptions.offset += super.byteLength;
      return res;
    });
  }

  override get byteLength() {
    return (this.relativeOffset + super.byteLength) * this.length;
  }
}

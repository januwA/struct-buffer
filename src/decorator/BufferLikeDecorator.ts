import { TypeDeep } from "../base/type-deep";
import {
  DecodeBuffer_t,
  IBufferLike,
  IDecodeOptions,
  IEncodeOptions,
} from "../interfaces";

export default class BufferLikeDecorator<D, E>
  extends TypeDeep<IBufferLike<D[], E[]>>
  implements IBufferLike<D, E>
{
  constructor(protected readonly src: IBufferLike<D, E>) {
    super();
  }

  decode(view: DecodeBuffer_t, options?: IDecodeOptions | undefined): D {
    return this.src.decode(view, options);
  }
  encode(obj: E, options?: IEncodeOptions | undefined): DataView {
    return this.src.encode(obj, options);
  }

  get byteLength() {
    return this.src.byteLength;
  }
}

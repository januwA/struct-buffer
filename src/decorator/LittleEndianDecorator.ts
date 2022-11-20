import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
} from "../interfaces";
import { TypeDeep } from "../base/type-deep";

export class LittleEndianDecorator<D, E>
  extends TypeDeep<IBufferLike<D[], E[]>>
  implements IBufferLike<D, E>
{
  override next(i: number) {
    const next = super.next(i);
    (next as any).src = this.src[i];
    return next;
  }

  constructor(
    private readonly src: IBufferLike<D, E>,
    private readonly littleEndian = true
  ) {
    super();
  }

  private optionsWithLittleEndian(options?: IEncodeOptions): IEncodeOptions {
    return Object.assign({}, options, {
      littleEndian: this.littleEndian,
    });
  }

  encode(obj: E, options?: IEncodeOptions): DataView {
    return this.src.encode(obj, this.optionsWithLittleEndian(options));
  }
  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    return this.src.decode(view, this.optionsWithLittleEndian(options));
  }
  get byteLength(): number {
    return this.src.byteLength;
  }
}

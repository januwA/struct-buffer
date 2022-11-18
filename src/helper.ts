import {
  DecodeBuffer_t,
  IByteLength,
  IDecode,
  IDecodeOptions,
  IEncode,
  IEncodeOptions,
  BufferLike_t,
} from "./interfaces";

export class LittleEndianDecorator<D, E>
  implements IByteLength, IDecode<D>, IEncode<E>
{
  constructor(
    private readonly src: BufferLike_t<D, E>,
    private readonly littleEndian = true
  ) {}

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

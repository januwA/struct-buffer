import { createDataView } from "../utils";
import { TypeDeep } from "../base/type-deep";
import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
} from "../interfaces";

export class RelativeOffsetDecorator<D, E>
  extends TypeDeep<IBufferLike<D[], E[]>>
  implements IBufferLike<D, E>
{
  constructor(
    protected readonly src: IBufferLike<D, E>,
    private readonly relativeOffset = 0
  ) {
    super();
  }

  encode(obj: E, options?: IEncodeOptions): DataView {
    const newOptions = Object.assign({}, options, {
      offset: options?.offset ?? 0,
      view: createDataView(this.byteLength, options?.view),
    });

    this.each(obj, (it) => {
      newOptions.offset += this.relativeOffset;
      newOptions.view = this.src.encode(it, newOptions);
      newOptions.offset += this.src.byteLength;
    });

    return newOptions.view!;
  }

  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const newOptions = Object.assign({}, options, {
      offset: options?.offset ?? 0,
    });

    return this.resultEach([], () => {
      newOptions.offset += this.relativeOffset;
      const res = this.src.decode(view, newOptions);
      newOptions.offset += this.src.byteLength;
      return res;
    });
  }

  get byteLength(): number {
    return (this.relativeOffset + this.src.byteLength) * this.length;
  }
}

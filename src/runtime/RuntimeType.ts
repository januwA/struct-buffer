import { TypeDeep } from "../base/type-deep";
import {
  LikeBuffer_t,
  IBufferLike,
  IDecodeOptions,
  IEncodeOptions,
} from "../interfaces";

export default abstract class RuntimeType<D, E>
  extends TypeDeep<IBufferLike<D[], E[]>>
  implements IBufferLike<D, E>
{
  protected _byteLength: number = 0;
  get byteLength() {
    return this._byteLength;
  }

  abstract decode(view: LikeBuffer_t, options?: IDecodeOptions | undefined): D;
  abstract encode(obj: E, options?: IEncodeOptions | undefined): DataView;
}

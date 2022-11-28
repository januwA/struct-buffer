import {
  LikeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  InjectDecode_t,
  InjectEncode_t,
} from "../interfaces";
import { createDataView, makeDataView, realloc } from "../utils";
import RuntimeType from "./RuntimeType";

export class Inject<D, E> extends RuntimeType<D, E> {
  /**
   * Customize the working content of decode and encode
   */
  constructor(
    private readonly injectDecode?: InjectDecode_t,
    private readonly injectEncode?: InjectEncode_t
  ) {
    super();
  }

  decode(view: LikeBuffer_t, options?: IDecodeOptions) {
    if (!this.injectDecode) return null;

    this._byteLength = 0;
    const _view = makeDataView(view);

    let offset = options?.offset ?? 0;

    return this.resultEach([], () => {
      const res = this.injectDecode!(_view, offset);
      offset += res.size;
      this._byteLength += res.size;
      return res.value;
    });
  }

  encode(obj: any, options?: IEncodeOptions): DataView {
    let view = createDataView(0, options?.view);
    if (!this.injectEncode) return view;

    let offset = options?.offset ?? 0;

    this._byteLength = 0;
    this.each(obj, (it) => {
      const buf = makeDataView(this.injectEncode!(it));
      view = realloc(view!, view!.byteLength + buf.byteLength, buf, offset);
      offset += buf.byteLength;
      this._byteLength += buf.byteLength;
    });
    return view;
  }
}

import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  InjectDecode_t,
  InjectEncode_t,
} from "../interfaces";
import { createDataView, makeDataView, realloc } from "../utils";
import { StructType } from "./StructType";

export class Inject extends StructType<any, any> {
  /**
   * Customize the working content of decode and encode
   */
  constructor(
    private readonly injectDecode?: InjectDecode_t,
    private readonly injectEncode?: InjectEncode_t
  ) {
    super(0, true);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    if (!this.injectDecode) return null;

    this.size = 0;
    const _view = makeDataView(view);

    let offset = options?.offset ?? 0;

    return this.resultEach([], () => {
      const res = this.injectDecode!(_view, offset);
      offset += res.size;
      this.size += res.size;
      return res.value;
    });
  }

  override encode(obj: any, options?: IEncodeOptions): DataView {
    let view = createDataView(0, options?.view);
    if (!this.injectEncode) return view;

    let offset = options?.offset ?? 0;

    this.size = 0;
    this.each(obj, (it) => {
      const buf = makeDataView(this.injectEncode!(it));
      view = realloc(view!, view!.byteLength + buf.byteLength, buf, offset);
      offset += buf.byteLength;
      this.size += buf.byteLength;
    });
    return view;
  }
}

import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  HInjectDecode,
  HInjectEncode,
} from "../interfaces";
import { createDataView, makeDataView, realloc } from "../utils";
import { StructType } from "./StructType";

export class Inject extends StructType<any, any> {
  /**
   * Customize the working content of decode and encode
   */
  constructor(
    private readonly hInjectDecode?: HInjectDecode,
    private readonly hInjectEncode?: HInjectEncode
  ) {
    super(0, true);
  }

  override get byteLength(): number {
    return this.size;
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    if (!this.hInjectDecode) return null;

    this.size = 0;
    view = makeDataView(view);

    let offset = options?.offset ?? 0;

    const result: any[] = [];
    let i = this.length;
    while (i--) {
      const res = this.hInjectDecode(view as DataView, offset);
      result.push(res.value);
      offset += res.size;
      this.size += res.size;
    }
    return this.unflattenDeep(result);
  }

  override encode(obj: any, options?: IEncodeOptions): DataView {
    let view = createDataView(0, options?.view);
    if (!this.hInjectEncode) return view;

    let offset = options?.offset ?? 0;

    this.size = 0;
    this.each(obj, (it) => {
      const buf = makeDataView(this.hInjectEncode!(it));
      view = realloc(view!, view!.byteLength + buf.byteLength, buf, offset);
      offset += buf.byteLength;
      this.size += buf.byteLength;
    });
    return view;
  }
}

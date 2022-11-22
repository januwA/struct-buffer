import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  DataViewSetBig_t,
} from "../interfaces";
import { createDataView, makeDataView } from "../utils";
import { StructType } from "./StructType";

export class StringType extends StructType<string, string> {
  constructor(
    private readonly textDecode = new TextDecoder(),
    private readonly textEncoder = new TextEncoder()
  ) {
    super(1, true);
  }

  /**
   * ```
   * string_t[2].decode([0x61, 0x62, 0, 0x63])
   * => ab
   * ```
   */
  override decode(view: DecodeBuffer_t, options?: IDecodeOptions) {
    const v = makeDataView(view);

    let offset = options?.offset ?? 0;

    const result: string[] = [];
    let i = this.length;
    while (i--) {
      let data = v[this.get](offset, options?.littleEndian) as number;
      if (data === 0) break;
      result.push(this.textDecode.decode(new Uint8Array([data])));
      offset += this.size;
    }

    // string_t[2] => 'ab'
    // string_t[2][1] => ['a', 'b']
    if (this.deeps.length < 2) return result.join("") as any;

    return this.unflattenDeep(result, true);
  }

  /**
   * ```
   * string_t[2].encode("abcd" as any)
   * =>  <61 62>
   * ```
   */
  override encode(obj: string, options?: IEncodeOptions): DataView {
    const v = createDataView(this.byteLength, options?.view);

    if (Array.isArray(obj)) (obj as any) = obj.flat().join("");

    let offset = options?.offset ?? 0,
      littleEndian = options?.littleEndian;

    const bytes: Uint8Array = this.textEncoder.encode(obj);

    for (let i = 0; i < this.length; i++) {
      const it = bytes[i] ?? 0;
      try {
        v[this.set](offset, it, littleEndian);
      } catch (_) {
        v[this.set as DataViewSetBig_t](offset, BigInt(it), littleEndian);
      }
      offset += this.size;
    }

    return v;
  }
}

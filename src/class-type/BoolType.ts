import { DecodeBuffer_t, IDecodeOptions, IEncodeOptions } from "../interfaces";
import { StructType } from "./StructType";

export class BoolType<
  D extends boolean,
  E extends boolean | number | bigint
> extends StructType<D, E> {
  constructor(type: StructType<any, any>) {
    super(type.size, type.unsigned);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    let r = super.decode(view, options) as any;
    if (Array.isArray(r)) {
      r = r.flat().map((it) => Boolean(it));
      r = this.unflattenDeep(r);
    } else {
      r = Boolean(r);
    }
    return r;
  }

  /**
   * 将obj转换为0或1来储存
   */
  override encode(obj: E, options?: IEncodeOptions): DataView {
    if (obj && Array.isArray(obj)) {
      obj = obj.flat().map((it) => Number(Boolean(it))) as any;
    } else if (obj) {
      obj = Number(Boolean(obj)) as any;
    }
    return super.encode(obj, options);
  }
}

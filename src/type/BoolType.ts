import { LikeBuffer_t, IDecodeOptions, IEncodeOptions } from "../interfaces";
import { StructType } from "./StructType";

export class BoolType<
  D extends boolean,
  E extends boolean | number | bigint
> extends StructType<D, E> {
  constructor(type: StructType<any, any>) {
    super(type.size, type.unsigned);
  }

  override decode(view: LikeBuffer_t, options?: IDecodeOptions): D {
    let r = super.decode(view, options) as any;
    return this.resultEach(r, (it) => {
      return Boolean(it);
    }) as any;
  }

  /**
   * 将obj转换为0或1来储存
   */
  override encode(obj: E, options?: IEncodeOptions): DataView {
    const convertObj = this.each(obj, (it) => Number(Boolean(it))) as number[];
    return super.encode(convertObj as any, options);
  }
}

import {
  Bit_t,
  LikeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  NumberMap_t,
} from "../interfaces";
import { createDataView } from "../utils";
import { StructType } from "./StructType";

export class BitsType<
  D = {
    [key in keyof NumberMap_t]: Bit_t;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: number, private readonly bits: NumberMap_t) {
    super(size, true);
  }

  override decode(view: LikeBuffer_t, options?: IDecodeOptions): D {
    const data: number[] | number = super.decode(view, options) as any;

    return this.resultEach(data, (num: number) => {
      const itemResult: { [k: string]: Bit_t } = {};
      Object.entries(this.bits).forEach(([flagKey, flagIndex]) => {
        itemResult[flagKey] = ((num & (1 << flagIndex)) >> flagIndex) as Bit_t;
      });
      return itemResult;
    }) as any;
  }

  /**
   *
   * @param el { [flag name]: 1 or 0 }
   * @returns
   */
  private getFlags(el: any): number {
    return Object.entries<number>(el).reduce(
      (acc, [flagKey, zeroOrOneValue]) => {
        const flagIndex: number = this.bits![flagKey];
        if (flagIndex !== undefined) acc |= zeroOrOneValue << flagIndex;
        return acc;
      },
      0
    );
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.byteLength, options?.view);

    let offset = options?.offset ?? 0,
      littleEndian = options?.littleEndian;

    this.each(obj, (it) => {
      const flags = this.getFlags(it);
      v[this.set](offset, flags, littleEndian);
      offset += this.size;
    });

    return v;
  }
}

export function bits(type: StructType<number, number>, obj: NumberMap_t) {
  return new BitsType(type.size, obj);
}

import {
  Bit_t,
  DecodeBuffer_t,
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
  constructor(size: number, public readonly bits: NumberMap_t) {
    super(size, true);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const data: number[] | number = super.decode(view, options) as any;

    const handle = (num: number) => {
      const result: { [k: string]: Bit_t } = {};
      Object.entries(this.bits).forEach(([k, i]) => {
        result[k] = (((num as number) & (1 << i)) >> i) as Bit_t;
      });
      return result as any;
    };

    if (this.isList && Array.isArray(data)) {
      return data.map((it) => handle(it)) as any;
    } else {
      return handle(data as number);
    }
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.length * this.size, options?.view);
    let offset = options?.offset ?? 0;

    const handle = (el: any) => {
      let flags = 0;
      Object.entries<number>(el).forEach(([k, v]) => {
        const i: number = this.bits![k];
        if (i !== undefined) flags |= v << i;
      });
      v[this.set](offset, flags, options?.littleEndian);
    };

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.length; i++) {
        handle(obj[i]);
        offset += this.size;
      }
    } else {
      handle(obj);
    }
    return v;
  }
}

export function bits(type: StructType<number, number>, obj: NumberMap_t) {
  return new BitsType(type.size, obj);
}

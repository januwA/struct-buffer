import { createDataView } from "../utils";
import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  NumberMap_t,
} from "../interfaces";
import { StructType } from "./StructType";

/**
 * ## bit-fields
 *
 * ```c++
 *struct T {
 *  uint8_t a : 1;
 *  uint8_t b : 2;
 *  uint8_t c : 3;
 *};
 *int main()
 *{
 *  T t{ 1,2,3 };
 *  printf("%p\n", &t); // *&t === `0001 1101` === `0x1D`
 *  printf("size: %d\n", sizeof(t)); // 1
 *  printf("%d\n", t.a); // 1
 *  printf("%d\n", t.b); // 2
 *  printf("%d\n", t.c); // 3
 *  return 0;
 *}
 * ```
 *
 * ## example
 * ```ts
 * const bf = bitFields(uint8_t, {
 *  a: 1,
 *  b: 2,
 *  c: 3,
 * });
 *
 * bf.dncode( new Uint8Array([0x1D]) ); // { a:1, b:2, c:3 }
 *
 * bf.encode({ a:1, b:2, c:3 });// <1D>
 * ```
 */
export class BitFieldsType<
  D = {
    [key in keyof NumberMap_t]: number;
  },
  E = Partial<D>
> extends StructType<D, E> {
  constructor(size: number, public readonly bitFields: NumberMap_t) {
    super(size, true);
  }

  override decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const data: number[] | number = super.decode(view, options) as any;

    let i = 0;
    const _getValue = (data: number, len: number) => {
      let val = 0;
      let count = 0;
      while (len--) {
        const b = (data >> i) & 1;
        val |= b << count;
        i++;
        count++;
      }
      return val;
    };

    const result: NumberMap_t = {};

    const handle = (num: number) => {
      Object.entries(this.bitFields).forEach(([k, len]) => {
        result[k] = _getValue(num, len);
      });
    };

    if (this.isList && Array.isArray(data)) {
      return data.map((it) => {
        return handle(it), result;
      }) as any;
    } else {
      return handle(data as number), result as any;
    }
  }

  override encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.length * this.size, options?.view);

    const _getValue = (obj: any): number => {
      let val = 0;
      let count = 0;
      Object.entries<number>(obj).forEach(([k, v]) => {
        const len: number = this.bitFields![k];
        if (len !== undefined) {
          val |= v << count;
          count += len;
        }
      });
      return val;
    };

    let offset = options?.offset ?? 0;

    if (this.isList && Array.isArray(obj)) {
      for (let i = 0; i < this.length; i++) {
        v[this.set](offset, _getValue(obj[i]), options?.littleEndian);
        offset += this.size;
      }
    } else {
      v[this.set](offset, _getValue(obj), options?.littleEndian);
    }
    return v;
  }
}

export function bitFields(type: StructType<number, number>, obj: NumberMap_t) {
  return new BitFieldsType(type.size, obj);
}

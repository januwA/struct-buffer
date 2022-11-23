import { TypeDeep } from "./base/type-deep";
import {
  AnyObject,
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  IBufferLike,
  StructBuffer_t,
} from "./interfaces";
import { createDataView, makeDataView, zeroMemory } from "./utils";

export class StructBuffer<
    D = {
      [k in keyof StructBuffer_t]: any;
    },
    E = Partial<D>
  >
  extends TypeDeep<StructBuffer<D[], E[]>>
  implements IBufferLike<D, E>
{
  private readonly structKV: [string, IBufferLike<any, any>][];

  constructor(private readonly struct: StructBuffer_t) {
    super();
    this.structKV = Object.entries(struct);
  }

  get byteLength(): number {
    // 每次获取 byteLength 都需要重新计算，因为 AbstractType.size 是可变的
    const _byteLength = Object.values(this.struct).reduce(
      (acc, type) => (acc += type.byteLength),
      0
    );
    return _byteLength * this.length;
  }

  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const littleEndian = options?.littleEndian,
      _view = makeDataView(view);

    let offset = options?.offset ?? 0;

    return this.resultEach([], () => {
      const res = this.structKV.reduce<AnyObject>((acc, [key, type]) => {
        acc[key] = type.decode(_view, { offset, littleEndian });
        offset += type.byteLength;
        return acc;
      }, {});

      return res;
    });
  }

  encode(obj: E, options?: IEncodeOptions): DataView {
    const byteLength = this.byteLength,
      count = this.length,
      littleEndian = options?.littleEndian;

    let view = createDataView(byteLength, options?.view),
      offset = options?.offset ?? 0;

    this.each(obj, (it: any) => {
      if (it === undefined) {
        const itemSize = byteLength / count;
        zeroMemory(view, itemSize, offset);
        offset += itemSize;
      } else {
        this.structKV.forEach(([key, type]) => {
          view = type.encode(it[key], { offset, littleEndian, view });
          offset += type.byteLength;
        });
      }
    });

    return view;
  }
}

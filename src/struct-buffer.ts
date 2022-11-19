import { TypeDeep } from "./type-deep";
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
    const typeByteLength = Object.values(this.struct).reduce(
      (acc, type) => (acc += type.byteLength),
      0
    );
    return typeByteLength * this.length;
  }

  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const littleEndian = options?.littleEndian;
    let offset = options?.offset ?? 0;

    view = makeDataView(view);
    const result: AnyObject[] = [];
    let i = this.length;
    while (i--) {
      const data = this.structKV.reduce<AnyObject>((acc, [key, type]) => {
        acc[key] = type.decode(view, { offset, littleEndian });
        offset += type.byteLength;
        return acc;
      }, {});
      result.push(data);
    }

    return this.unflattenDeep(result);
  }

  encode(obj: E, options?: IEncodeOptions): DataView {
    const byteLength = this.byteLength,
      isList = this.isList,
      count = this.length,
      littleEndian = options?.littleEndian;

    let v = createDataView(byteLength, options?.view);
    if (isList && Array.isArray(obj)) (obj as any) = obj.flat();

    let offset = options?.offset ?? 0;

    for (let i = 0; i < count; i++) {
      const it: any = isList ? (obj as any)[i] : obj;
      if (it === undefined) {
        const itemSize = byteLength / count;
        zeroMemory(v, itemSize, offset);
        offset += itemSize;
        continue;
      }
      v = this.structKV.reduce<DataView>((view: DataView, [key, type]) => {
        view = type.encode(it[key], { offset, littleEndian, view });
        offset += type.byteLength;
        return view;
      }, v);
    }

    return v;
  }
}

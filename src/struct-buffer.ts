import { StructType } from "./class-type";
import { AnyObject } from "./interfaces";
import {
  arrayProxyNext,
  createDataView,
  makeDataView,
  unflattenDeep,
  zeroMemory,
} from "./utils";

export type Type_t = StructType<any, any> | StructBuffer;
export type StructBuffer_t = { [k: string]: Type_t };

/**
 * Get the size after byte alignment
 */
export function sizeof(type: Type_t): number {
  if (type instanceof StructBuffer) {
    let padidng = 0;
    const maxSize = type.maxSize;
    const size = byteLength(type, 1);
    while ((size + padidng++) % maxSize);
    return (size + padidng - 1) * type.count;
  }
  return type.isList ? type.size * type.count : type.size;
}

function byteLength(sb: StructBuffer, count?: number) {
  const typeByteLength: number = Object.values(sb.struct).reduce(
    (acc: number, type) => {
      if (type instanceof StructBuffer) acc += type.byteLength;
      else acc += sizeof(type);
      return acc;
    },
    0
  );
  return typeByteLength * (count ?? sb.count);
}

class StructBufferNext {
  constructor() {
    return arrayProxyNext(this, StructBufferNext);
  }
}

type StructBufferConfig = {
  textDecode?: TextDecoder;
  textEncoder?: TextEncoder;

  /**
   * Setting littleEndian here will cause the littleEndian parameters of `encode` and `decode` to become invalid
   * 
   * https://github.com/januwA/struct-buffer/issues/2
   */
  littleEndian?: boolean;
};

const KStructBufferConfig = {
  textDecode: new TextDecoder(),
  textEncoder: new TextEncoder(),
  littleEndian: undefined,
};

export class StructBuffer<
  D = {
    [k in keyof StructBuffer_t]: any;
  },
  E = Partial<D>
> extends Array<StructBuffer<D[], E[]>> {
  deeps: number[] = [];
  config: StructBufferConfig = Object.assign({}, KStructBufferConfig);
  structKV: [string, Type_t][];

  constructor(
    public structName: string,
    public struct: StructBuffer_t,
    config?: StructBufferConfig
  ) {
    super();
    Object.assign(this.config, config);
    this.structKV = Object.entries(struct);
    return arrayProxyNext(this, StructBufferNext);
  }

  /**
   *
   * ```js
   * s_user = new StructBuffer({})
   * s_users = new StructBuffer({
   *   users: s_user[2]
   * })
   * s_users.decode(...)
   * ```
   */
  get isList(): boolean {
    return !!this.deeps.length;
  }

  /**
   * 最少返回 1
   */
  get count(): number {
    return this.deeps.reduce((acc, it) => (acc *= it), 1);
  }

  get byteLength(): number {
    return byteLength(this as any);
  }

  get maxSize(): number {
    return Math.max(
      ...Object.values(this.struct).map((type) =>
        type instanceof StructBuffer ? type.maxSize : type.size
      )
    );
  }

  decode(
    view: ArrayBufferView | number[],
    littleEndian: boolean = false,
    offset: number = 0
  ): D {
    littleEndian = this.config.littleEndian ?? littleEndian;
    view = makeDataView(view);
    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      const data = this.structKV.reduce<AnyObject>((acc, [key, type]) => {
        if (type instanceof StructBuffer) {
          acc[key] = type.decode(view, type.config.littleEndian ?? littleEndian, offset);
          offset += type.byteLength;
        } else {
          acc[key] = (type as any).decode(
            view,
            littleEndian,
            offset,
            this.config.textDecode
          );
          offset += sizeof(type);
        }
        return acc;
      }, {});
      result.push(data);
    }

    return this.isList ? unflattenDeep(result, this.deeps) : result[0];
  }

  encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    littleEndian = this.config.littleEndian ?? littleEndian;
    const v = createDataView(this.byteLength, view);
    if (this.isList && Array.isArray(obj)) (obj as any) = obj.flat();

    for (let i = 0; i < this.count; i++) {
      const it: any = this.isList ? (obj as any)[i] : obj;
      if (it === undefined) {
        const itemSize = this.byteLength / this.count;
        zeroMemory(v, itemSize, offset);
        offset += itemSize;
        continue;
      }
      this.structKV.reduce<DataView>((view: DataView, [key, type]) => {
        const value = it[key];
        if (type instanceof StructBuffer) {
          type.encode(value, type.config.littleEndian ?? littleEndian, offset, view);
          offset += type.byteLength;
        } else {
          (type as any).encode(
            value,
            littleEndian,
            offset,
            view,
            this.config.textEncoder
          );
          offset += sizeof(type);
        }
        return view;
      }, v);
    }
    return v;
  }
}

import { StructType } from "./class-type";
import { AnyObject } from "./interfaces";
import {
  arrayNextProxy,
  arrayProxy,
  createDataView,
  makeDataView,
  unflattenDeep,
  zeroMemory,
} from "./utils";

/**
 * Get the size after byte alignment
 */
export function sizeof(
  type: StructType<any, any> | StructBuffer<IStructBuffer>
): number {
  if (type instanceof StructBuffer) {
    let padidng = 0;
    const maxSize = type.maxSize;
    const size = byteLength(type, 1);
    while ((size + padidng++) % maxSize);
    return (size + padidng - 1) * type.count;
  }
  return type.isList ? type.size * type.count : type.size;
}

function byteLength(sb: StructBuffer<IStructBuffer>, count?: number) {
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

export interface IStructBuffer {
  [k: string]: StructType<any, any> | StructBuffer<IStructBuffer>;
}

class StructBufferNext<T extends IStructBuffer> {
  deeps: number[] = [];
  constructor(
    i: number,
    public readonly structName: string,
    public readonly struct: T
  ) {
    this.deeps.push(i);
    return arrayNextProxy(this);
  }
}

export class StructBuffer<
  T extends IStructBuffer,
  D = {
    [k in keyof T]: any;
  },
  E = {
    [k in keyof T]?: any;
  }
> extends Array<StructBuffer<T, D[], E[]>> {
  deeps: number[] = [];
  textDecode = new TextDecoder();
  textEncoder = new TextEncoder();
  structKV: [string, StructType<any, any> | StructBuffer<IStructBuffer>][];

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

  constructor(public readonly structName: string, public readonly struct: T) {
    super();
    this.structKV = Object.entries(struct);
    return arrayProxy(this, (o, i) => {
      const newProxy: any = new StructBufferNext(i, o.structName, o.struct);
      newProxy.textDecode = o.textDecode;
      newProxy.textEncoder = o.textEncoder;
      newProxy.structKV = o.structKV;
      Object.setPrototypeOf(newProxy, StructBuffer.prototype);
      return newProxy;
    });
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
    view = makeDataView(view);
    const result: AnyObject[] = [];
    let i = this.count;
    while (i--) {
      const data = this.structKV.reduce<AnyObject>((acc, [key, type]) => {
        if (type instanceof StructBuffer) {
          acc[key] = type.decode(view, littleEndian, offset);
          offset += type.byteLength;
        } else {
          acc[key] = (type as any).decode(
            view,
            littleEndian,
            offset,
            this.textDecode
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
      this.structKV.reduce<DataView>((acc: DataView, [key, type]) => {
        const value = it[key];
        if (type instanceof StructBuffer) {
          type.encode(value, littleEndian, offset, acc);
          offset += type.byteLength;
        } else {
          (type as any).encode(
            value,
            littleEndian,
            offset,
            acc,
            this.textEncoder
          );
          offset += sizeof(type);
        }
        return acc;
      }, v);
    }
    return v;
  }
}

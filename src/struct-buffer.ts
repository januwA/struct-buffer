import { StructType } from "./class-type";
import { AnyObject } from "./interfaces";
import {
  arrayNextProxy,
  arrayProxy,
  createDataView,
  unflattenDeep,
  zeroMemory,
} from "./utils";

/**
 * Get the size after byte alignment
 * @param type Single type or Struct Buffer
 */
export function sizeof(type: StructType | StructBuffer): number {
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
  const typeByteLength = Object.values(sb.struct).reduce((acc, type) => {
    if (type instanceof StructBuffer) acc += type.byteLength;
    else acc += sizeof(type);
    return acc;
  }, 0);
  return typeByteLength * (count ?? sb.count);
}

class StructBufferNext {
  deeps: number[] = [];
  constructor(
    i: number,
    public readonly structName: string,
    public readonly struct: {
      [k: string]: StructType | StructBuffer;
    }
  ) {
    this.deeps.push(i);
    return arrayNextProxy(this);
  }
}

export class StructBuffer extends Array<StructBuffer> {
  deeps: number[] = [];
  textDecode = new TextDecoder();
  textEncoder = new TextEncoder();

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

  constructor(
    public readonly structName: string,
    public readonly struct: {
      [k: string]: StructType | StructBuffer;
    }
  ) {
    super();
    return arrayProxy(this, (o, i) => {
      const newProxy: any = new StructBufferNext(i, o.structName, o.struct);
      newProxy.textDecode = o.textDecode;
      newProxy.textEncoder = o.textEncoder;
      Object.setPrototypeOf(newProxy, StructBuffer.prototype);
      return newProxy;
    });
  }

  get byteLength(): number {
    return byteLength(this);
  }

  get maxSize(): number {
    return Math.max(
      ...Object.values(this.struct).map((type) => {
        if (type instanceof StructBuffer) return type.maxSize;
        return type.size;
      })
    );
  }

  decode(
    view: ArrayBufferView,
    littleEndian: boolean = false,
    offset: number = 0
  ): AnyObject {
    if (!(view instanceof DataView)) view = new DataView(view.buffer);

    const result: AnyObject[] = [];
    for (let i = 0; i < this.count; i++) {
      const data = Object.entries(this.struct).reduce<AnyObject>(
        (acc, [key, type]) => {
          if (type instanceof StructBuffer) {
            acc[key] = type.decode(view, littleEndian, offset);
            offset += type.byteLength;
          } else {
            acc[key] = type.decode(view, littleEndian, offset, this.textDecode);
            offset += sizeof(type);
          }
          return acc;
        },
        {}
      );
      result.push(data);
    }

    return this.isList ? unflattenDeep(result, this.deeps) : result[0];
  }

  encode(
    obj: AnyObject,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = createDataView(this.byteLength, view);

    if (this.isList && Array.isArray(obj)) obj = obj.flat();

    for (let i = 0; i < this.count; i++) {
      const it = this.isList ? obj[i] : obj;
      if (it === undefined) {
        const itemSize = this.byteLength / this.count;
        zeroMemory(v, itemSize, offset);
        offset += itemSize;
        continue;
      }
      Object.entries(this.struct).reduce<DataView>(
        (acc: DataView, [key, type]) => {
          const value = it[key];
          if (type instanceof StructBuffer) {
            type.encode(value, littleEndian, offset, acc);
            offset += type.byteLength;
          } else {
            type.encode(value, littleEndian, offset, acc, this.textEncoder);
            offset += sizeof(type);
          }
          return acc;
        },
        v
      );
    }
    return v;
  }
}

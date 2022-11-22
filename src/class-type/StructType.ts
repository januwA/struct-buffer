import {
  DecodeBuffer_t,
  IDecodeOptions,
  IEncodeOptions,
  DataViewSetBig_t,
  IBufferLike,
  IType,
  DataViewGet_t,
  DataViewSetExcludeBig_t,
} from "../interfaces";
import { TypeDeep } from "../base/type-deep";
import { createDataView, makeDataView, typeHandle } from "../utils";

abstract class AbstractType<T> extends TypeDeep<T> implements IType {
  protected readonly get: DataViewGet_t;
  protected readonly set: DataViewSetExcludeBig_t;

  /**
   * size和unsigned属性用于获取DataView中get和set相关的操作方法
   */
  constructor(public size: number, public readonly unsigned: boolean) {
    super();
    [this.get, this.set] = typeHandle(this);
  }
  get isFloat(): boolean {
    return false;
  }
  get isDouble(): boolean {
    return false;
  }
}

// D decode return type
// E encode obj type
export class StructType<D, E>
  extends AbstractType<StructType<D[], E[]>>
  implements IBufferLike<D, E>
{
  constructor(size: number, unsigned: boolean) {
    super(size, unsigned);
  }

  get byteLength(): number {
    return this.isList ? this.size * this.length : this.size;
  }

  /**
   *
   * ```ts
   * uint32_t.decode( new Uint8Array([0,0,0,1]) ) => 1
   *
   * uint32_t[2].decode( new Uint8Array([0,0,0,1, 0,0,0,2]) ) => [1, 2]
   * ```
   */
  decode(view: DecodeBuffer_t, options?: IDecodeOptions): D {
    const v = makeDataView(view);
    let offset = options?.offset ?? 0;
    const result: (number | bigint)[] = [];
    let i = this.length;
    while (i--) {
      result.push(v[this.get](offset, options?.littleEndian));
      offset += this.size;
    }
    return this.unflattenDeep(result);
  }

  /**
   *
   * ```ts
   * uint32_t.encode(4)         => <00 00 00 02>
   *
   * uint32_t[2].encode([1,2])  => <00 00 00 01 00 00 00 02>
   *
   * // padding zero
   * uint32_t[2].encode([1])    => <00 00 00 01 00 00 00 00>
   * ```
   */
  encode(obj: E, options?: IEncodeOptions): DataView {
    const v = createDataView(this.byteLength, options?.view);

    let offset = options?.offset ?? 0,
      littleEndian = options?.littleEndian;

    this.each(obj, (it: number) => {
      if (!it) it = 0;

      try {
        v[this.set](offset, it, littleEndian);
      } catch (error) {
        // BigInt 最少需要8字节
        v[this.set as DataViewSetBig_t](offset, BigInt(it), littleEndian);
      }
      offset += this.size;
    });

    return v;
  }
}

/**
 *
 * Register a new type
 *
 * @param size type byte size
 * @param unsigned unsigned bit, default `true`
 * @returns
 */
export function registerType<D, E>(size: number, unsigned = true) {
  return new StructType<D, E>(size, unsigned);
}

/**
 *
 * Inherit the "size" and "unsigned" attributes
 *
 */
export function typedef<D, E>(type: StructType<D, E>) {
  return registerType<D, E>(type.size, type.unsigned);
}

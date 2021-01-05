import { AnyObject } from "./interfaces";
import {
  arrayNextProxy,
  arrayProxy,
  createDataView,
  unflattenDeep,
} from "./utils";

function typeHandle(type: StructType): { set: string; get: string } {
  switch (type.size) {
    case 1:
      return {
        get: type.unsigned ? "getUint8" : "getInt8",
        set: type.unsigned ? "setUint8" : "setInt8",
      };
    case 2:
      return {
        get: type.unsigned ? "getUint16" : "getInt16",
        set: type.unsigned ? "setUint16" : "setInt16",
      };

    case 4:
      const isFloat = type.isName("float");
      return {
        get: isFloat ? "getFloat32" : type.unsigned ? "getUint32" : "getInt32",
        set: isFloat ? "setFloat32" : type.unsigned ? "setUint32" : "setInt32",
      };

    case 8:
      const isDouble = type.isName("double");
      return {
        get: isDouble
          ? "getFloat64"
          : type.unsigned
          ? "getBigUint64"
          : "getBigInt64",
        set: isDouble
          ? "setFloat64"
          : type.unsigned
          ? "setBigUint64"
          : "setBigInt64",
      };

    default:
      throw new Error(`StructBuffer: Unrecognized ${type} type.`);
  }
}

class StructTypeNext {
  deeps: number[] = [];

  constructor(
    i: number,
    public readonly names: string[],
    public readonly size: number,
    public readonly unsigned: boolean,
    public readonly get: string,
    public readonly set: string
  ) {
    this.deeps.push(i);
    return arrayNextProxy(this);
  }
}

export class StructType extends Array<StructType> {
  names: string[];
  deeps: number[] = [];

  /**
   * ```
   * float[2] => true
   * float    => false
   * ```
   */
  get isList(): boolean {
    return !!this.deeps.length;
  }

  // 最少会返回1
  get count(): number {
    return this.deeps.reduce((acc, it) => (acc *= it), 1);
  }

  is(type: StructType): boolean {
    return type.names.some((name) => this.names.includes(name));
  }

  isName(typeName: string) {
    return this.names.includes(typeName);
  }

  get: string;
  set: string;

  constructor(
    typeName: string | string[],
    public readonly size: 1 | 2 | 4 | 8,
    public readonly unsigned: boolean
  ) {
    super();

    this.names = Array.isArray(typeName) ? typeName : [typeName];
    const { set, get } = typeHandle(this);
    this.set = set;
    this.get = get;
    return arrayProxy(this, (o, i) => {
      const newProxy: any = new StructTypeNext(
        i,
        o.names,
        o.size,
        o.unsigned,
        o.get,
        o.set
      );

      // 避免 instanceof 检测
      // 同时prototype上的属性和方法也会拷贝过去
      Object.setPrototypeOf(newProxy, StructType.prototype);
      return newProxy;
    });
  }

  /**
   *
   * ```ts
   * DWORD.decode( new Uint8Array([0,0,0,1]) ) => 1
   *
   * DWORD[2].decode( new Uint8Array([0,0,0,1, 0,0,0,2]) ) => [1, 2]
   * ```
   *
   * @param view
   * @param littleEndian
   * @param offset
   * @param textDecode
   */
  decode(
    view: ArrayBufferView,
    littleEndian: boolean = false,
    offset: number = 0,
    textDecode?: TextDecoder
  ): any {
    if (!(view instanceof DataView)) view = new DataView(view.buffer);

    const isString = this.isName("string_t");
    const result: AnyObject[] = [];
    for (let i = 0; i < this.count; i++) {
      let data = (view as any)[this.get](offset, littleEndian);
      if (isString) {
        // 截断字符串
        if (data === 0) break;
        if (!textDecode) textDecode = new TextDecoder();
        data = textDecode.decode(new Uint8Array([data]));
      }
      result.push(data);
      offset += this.size;
    }

    // string_t[2] => 'ab'
    // string_t[2][1] => ['a', 'b']
    if (isString && this.deeps.length < 2) return result.join("");

    return this.isList
      ? unflattenDeep(result, this.deeps, isString)
      : result[0];
  }

  /**
   *
   * ```ts
   * DWORD.encode(4)         => <00 00 00 02>
   *
   * DWORD[2].encode([1,2])  => <00 00 00 01 00 00 00 02>
   *
   * // padding zero
   * DWORD[2].encode([1])    => <00 00 00 01 00 00 00 00>
   * ```
   *
   * @param obj
   * @param littleEndian
   * @param offset
   * @param view
   * @param textEncoder
   */
  encode(
    obj: any /* AnyObject | string | number | undefined */,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    textEncoder?: TextEncoder
  ): DataView {
    const v = createDataView(this.count * this.size, view);
    const isString = this.isName("string_t");

    if (this.isList && Array.isArray(obj)) {
      obj = obj.flat();
      if (isString) obj = obj.join("");
    }

    if (isString) {
      if (!textEncoder) textEncoder = new TextEncoder();
      obj = textEncoder.encode(obj);
    }

    for (let i = 0; i < this.count; i++) {
      const it = (this.isList ? obj[i] : obj) ?? 0;
      try {
        (v as any)[this.set](offset, it, littleEndian);
      } catch (error) {
        (v as any)[this.set](offset, BigInt(it), littleEndian);
      }
      offset += this.size;
    }

    return v;
  }
}

/**
 *
 * @param typeName
 * @param size
 * @param unsigned
 */
export function registerType(
  typeName: string | string[],
  size: 1 | 2 | 4 | 8,
  unsigned = true
): StructType {
  return new StructType(typeName, size, unsigned);
}

/**
 *
 * ```js
 * int8_t = typedef("int8_t", char);
 * ```
 *
 * @param typeName
 * @param type
 */
export function typedef(typeName: string | string[], type: StructType) {
  const newType = registerType(typeName, type.size, type.unsigned);
  return newType;
}

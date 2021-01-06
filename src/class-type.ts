import { AnyObject } from "./interfaces";
import {
  arrayNextProxy,
  arrayProxy,
  createDataView,
  unflattenDeep,
} from "./utils";

const FLOAT_TYPE = "float";
const DOUBLE_TYPE = "double";
const STRING_TYPE = "string_t";

const hData: any = {
  1: {
    1: "getUint8",
    0: "getInt8",
  },
  2: {
    1: "getUint16",
    0: "getInt16",
  },
  4: {
    1: "getUint32",
    0: "getInt32",
  },
  8: {
    1: "getBigUint64",
    0: "getBigInt64",
  },
  f: "getFloat32",
  d: "getFloat64",
};

function typeHandle(type: StructType): [get: string, set: string] {
  let h: string | undefined = undefined;
  const isFloat =
    type.isName(FLOAT_TYPE.toLowerCase()) ||
    type.isName(FLOAT_TYPE.toUpperCase());

  const isDouble =
    type.isName(DOUBLE_TYPE.toLowerCase()) ||
    type.isName(DOUBLE_TYPE.toUpperCase());
  if (isFloat) h = hData["f"];
  if (isDouble) h = hData["d"];

  if (!h) h = hData[type.size][+type.unsigned];
  if (!h) throw new Error(`StructBuffer: Unrecognized ${type} type.`);

  return [h, h.replace(/^(g)/, "s")];
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
    const [get, set] = typeHandle(this);
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

    const isString = this.isName(STRING_TYPE);
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
    const isString = this.isName(STRING_TYPE);

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
 * Register a new type
 *
 * ```ts
 * const int = registerType(["int", "signed", "signed int"], 4, false);
 * ```
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
 * Inherit the "size" and "unsigned" attributes
 *
 * ```ts
 * const int8_t = typedef("int8_t", char);
 * ```
 * @param typeName
 * @param type
 */
export function typedef(typeName: string | string[], type: StructType) {
  const newType = registerType(typeName, type.size, type.unsigned);
  return newType;
}

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
    const proxy: this = new Proxy(this, {
      get(o: any, k: string | number | symbol) {
        if (k in o) return o[k];

        k = k.toString();
        if (/\d+/.test(k)) {
          o.deeps.push(parseInt(k));
        }
        return proxy;
      },
    });
    return proxy;
  }
}

export class StructType extends Array {
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
    for (const name of type.names) {
      if (this.names.includes(name)) return true;
    }
    return false;
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
    return new Proxy(this, {
      get(o: any, k: string | number | symbol) {
        if (k in o) return o[k];

        // 如果访问char[2] ，数字属性，返回一个新的proxy，避免上下文冲突
        k = k.toString();
        if (/\d+/.test(k)) {
          const newProxy: any = new StructTypeNext(
            parseInt(k),
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
        }
      },
    });
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

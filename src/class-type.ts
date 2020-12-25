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
      const isFloat = type.typeName === "float";
      return {
        get: isFloat ? "getFloat32" : type.unsigned ? "getUint32" : "getInt32",
        set: isFloat ? "setFloat32" : type.unsigned ? "setUint32" : "setInt32",
      };

    case 8:
      const isDouble = type.typeName === "double";
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
    k: number,
    public readonly typeName: string,
    public readonly size: number,
    public readonly unsigned: boolean,
    public readonly get: string,
    public readonly set: string
  ) {
    this.deeps.push(k);
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
    return type.typeName === this.typeName;
  }

  get: string;
  set: string;

  constructor(
    public readonly typeName: string,
    public readonly size: 1 | 2 | 4 | 8,
    public readonly unsigned: boolean
  ) {
    super();
    const { set, get } = typeHandle(this);
    this.set = set;
    this.get = get;
    const proxy: this = new Proxy(this, {
      get(o: any, k: string | number | symbol) {
        // 普通属性直接返回
        if (k in o) return o[k];

        // 如果访问char[2] ，数字属性，那么立即返回一个新的proxy，避免上下文冲突
        k = k.toString();
        if (/\d+/.test(k)) {
          const newProxy: any = new StructTypeNext(
            parseInt(k),
            o.typeName,
            o.size,
            o.unsigned,
            o.get,
            o.set
          );

          // 避免 instanceof 检测
          // 同时prototype上的属性和方法也会拷贝过去
          Object.setPrototypeOf(newProxy, StructType.prototype);
          return newProxy;
        } else {
          throw new Error(
            `StructBuffer: (${o.typeName.toUpperCase()}) type error.`
          );
        }
      },
    });
    return proxy;
  }
}

export function registerType(
  typeName: string,
  size: 1 | 2 | 4 | 8,
  unsigned = true
): StructType {
  return new StructType(typeName, size, unsigned);
}

class StructTypeNext {
  deeps: number[] = [];

  constructor(k: number, public readonly typeName: string) {
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

export abstract class StructType extends Array {
  abstract typeName: string;

  deeps: number[] = [];

  /**
   * ```
   * <type>[<n>]
   * <type>[<n>][<n>]...
   * ```
   */
  get isList(): boolean {
    return !!this.deeps.length;
  }

  // 最少会返回1
  get count(): number {
    return this.deeps.reduce((acc, it) => (acc *= it), 1);
  }

  constructor() {
    super();
    const proxy: this = new Proxy(this, {
      get(o: any, k: string | number | symbol) {
        // 普通属性直接返回
        if (k in o) return o[k];

        // 如果访问char[2] ，数字属性，那么立即返回一个新的proxy，避免上下文冲突
        k = k.toString();
        if (/\d+/.test(k)) {
          const newProxy: any = new StructTypeNext(parseInt(k), o.typeName);

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

export class Char extends StructType {
  typeName: string = "char";
}
export class String_t extends StructType {
  typeName: string = "string_t";
}
export class Float extends StructType {
  typeName: string = "float";
}
export class Double extends StructType {
  typeName: string = "double";
}
export class Int8_t extends StructType {
  typeName: string = "int8_t";
}
export class Int16_t extends StructType {
  typeName: string = "int16_t";
}
export class Int32_t extends StructType {
  typeName: string = "int32_t";
}
export class Int64_t extends StructType {
  typeName: string = "int64_t";
}
export class Byte extends StructType {
  typeName: string = "byte";
}
export class Word extends StructType {
  typeName: string = "word";
}
export class Dword extends StructType {
  typeName: string = "dword";
}
export class Qword extends StructType {
  typeName: string = "qword";
}
export class Uint8_t extends StructType {
  typeName: string = "uint8_t";
}
export class Uint16_t extends StructType {
  typeName: string = "uint16_t";
}
export class Uint32_t extends StructType {
  typeName: string = "uint32_t";
}
export class Uint64_t extends StructType {
  typeName: string = "uint64_t";
}

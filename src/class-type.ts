export abstract class StructType extends Array {
  abstract typeName: string;

  constructor() {
    super();
    return new Proxy(this, {
      get: this.get,
    });
  }

  private get(target: any, k: string | number | symbol) {
    if (k === "typeName") return target[k];

    k = k.toString();
    if (/\d+/.test(k)) {
      return `${target.typeName.toLowerCase()}[${k}]`;
    } else {
      throw new Error(
        `StructBuffer: (${target.typeName.toUpperCase()}) type error.`
      );
    }
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

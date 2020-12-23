export class Char {}
// char[10] or char
export const char: any = new Proxy(new Char(), {
  get(_, k) {
    k = k.toString();
    if (/\d+/.test(k)) {
      return `char[${k}]`;
    } else {
      throw new Error("CHAR type error.");
    }
  },
});

export class String_t {}
export const string_t: any = new Proxy(new String_t(), {
  get(_, k) {
    k = k.toString();
    if (/\d+/.test(k)) {
      return `string_t[${k}]`;
    } else {
      throw new Error("string_t type error.");
    }
  },
});

// Floating point / 浮点
export const float = "float";
export const double = "doubel";

// signed integer / 有符号整数
export const int8_t = "int8_t";
export const int16_t = "int16_t";
export const int32_t = "int32_t";
export const int64_t = "int64_t";

// unsigned integer / 无符号整数
export const BYTE = "byte";
export const WORD = "word";
export const DWORD = "dword";
export const QWORD = "qword";
export const uint8_t = "uint8_t";
export const uint16_t = "uint16_t";
export const uint32_t = "uint32_t";
export const uint64_t = "uint64_t";

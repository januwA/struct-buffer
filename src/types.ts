import {
  Char,
  Double,
  Float,
  String_t,
  Int8_t,
  Int16_t,
  Int32_t,
  Int64_t,
  Byte,
  Word,
  Dword,
  Qword,
  Uint8_t,
  Uint16_t,
  Uint32_t,
  Uint64_t,
} from "./class-type";

export const char = new Char();
export const string_t = new String_t();

// Floating point / 浮点
export const float = new Float();
export const double = new Double();

// signed integer / 有符号整数
export const int8_t = new Int8_t();
export const int16_t = new Int16_t();
export const int32_t = new Int32_t();
export const int64_t = new Int64_t();

// unsigned integer / 无符号整数
export const BYTE = new Byte();
export const WORD = new Word();
export const DWORD = new Dword();
export const QWORD = new Qword();
export const uint8_t = new Uint8_t();
export const uint16_t = new Uint16_t();
export const uint32_t = new Uint32_t();
export const uint64_t = new Uint64_t();

export const ALL_TYPE_NAMES: string[] = [
  int8_t.typeName,
  int16_t.typeName,
  int32_t.typeName,
  int64_t.typeName,
  uint8_t.typeName,
  uint16_t.typeName,
  uint32_t.typeName,
  uint64_t.typeName,
  BYTE.typeName,
  WORD.typeName,
  DWORD.typeName,
  QWORD.typeName,
  float.typeName,
  double.typeName,
  char.typeName,
  string_t.typeName,
];

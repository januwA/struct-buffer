import {
  BoolType,
  registerType,
  typedef,
  DoubleType,
  FloatType,
  PaddingType,
  StringType,
} from "./class-type";

export const string_t = new StringType();
export const padding_t = new PaddingType();

// c-type
export const char = registerType<number, number>(1, false);
export const uchar = registerType<number, number>(1);

export const short = registerType<number, number>(2, false);
export const ushort = registerType<number, number>(2);

export const int = registerType<number, number>(4, false);
export const uint = registerType<number, number>(4);

export const long = registerType<number, number>(4, false);
export const ulong = registerType<number, number>(4);

export const longlong = registerType<bigint, bigint>(8, false);
export const ulonglong = registerType<bigint, bigint>(8);

export const bool = new BoolType(char);

export const float = new FloatType();
export const double = new DoubleType();

// c++ type
export const int8_t = typedef(char);
export const int16_t = typedef(short);
export const int32_t = typedef(int);
export const int64_t = typedef(longlong);

export const uint8_t = typedef(uchar);
export const uint16_t = typedef(ushort);
export const uint32_t = typedef(uint);
export const uint64_t = typedef(ulonglong);

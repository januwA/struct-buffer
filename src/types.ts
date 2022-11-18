import {
  BoolType,
  DoubleType,
  FloatType,
  PaddingType,
  registerType,
  StringType,
  typedef,
} from "./class-type";

export const string_t = new StringType();
export const padding_t = new PaddingType();

// c-type
export const char = registerType(1, false);
export const bool = new BoolType(char);
export const uchar = registerType(1);
export const short = registerType(2, false);

export const ushort = registerType(2);
export const int = registerType(4, false);
export const uint = registerType(4);
export const long = registerType(4, false);
export const ulong = registerType(4);
export const longlong = registerType(8, false);
export const ulonglong = registerType(8);
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

// windows
export const BOOL = new BoolType(int);
export const BYTE = typedef(uchar);
export const WORD = typedef(ushort);
export const DWORD = typedef(ulong);
export const QWORD = registerType(8);

export const FLOAT = typedef(float);
export const DOUBLE = typedef(double);

export const CHAR = typedef(char);
export const UCHAR = typedef(uchar);

export const SHORT = typedef(short);
export const USHORT = typedef(ushort);

export const INT = typedef(int);
export const UINT = typedef(uint);

export const LONG = typedef(long);
export const ULONG = typedef(ulong);

export const LONGLONG = typedef(longlong);
export const ULONGLONG = typedef(ulonglong);

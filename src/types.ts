import { registerType, typedef } from "./class-type";

export const string_t = registerType("string_t", 1);

// c-type
export const char = registerType(["char", "signed char"], 1, false);
export const uchar = registerType("unsigned char", 1);

export const short = registerType(
  ["short", "short int", "signed short", "signed short int"],
  2,
  false
);
export const ushort = registerType(["unsigned short", "unsigned short int"], 2);

export const int = registerType(["int", "signed", "signed int"], 4, false);
export const uint = registerType(["unsigned", "unsigned int"], 4);

export const long = registerType(
  ["long", "long int", "signed long", "signed long int"],
  4,
  false
);
export const ulong = registerType(["unsigned long", "unsigned long int"], 4);

export const longlong = registerType(
  ["long long", "long long int", "signed long long", "signed long long int"],
  8,
  false
);
export const ulonglong = registerType(
  ["unsigned long long", "unsigned long long int"],
  8
);

export const float = registerType("float", 4);
export const double = registerType(["double", "long double"], 8);

// c++ type
export const int8_t = typedef(["int8_t", "__int8"], char);
export const int16_t = typedef(["int16_t", "__int16"], short);
export const int32_t = typedef(["int32_t", "__int32"], int);
export const int64_t = typedef(["int64_t", "__int64"], longlong);

export const uint8_t = typedef(["uint8_t", "unsigned __int8"], uchar);
export const uint16_t = typedef(["uint16_t", "unsigned __int16"], ushort);
export const uint32_t = typedef(["uint32_t", "unsigned __int32"], uint);
export const uint64_t = typedef(["uint64_t", "unsigned __int64"], ulonglong);

// windows
export const BOOL = typedef("BOOL", int);
export const BYTE = typedef("BYTE", uchar);
export const WORD = typedef("WORD", ushort);
export const DWORD = typedef("DWORD", ulong);
export const QWORD = registerType("QWORD", 8);

export const FLOAT = typedef("FLOAT", float);

export const CHAR = typedef("CHAR", char);
export const UCHAR = typedef("UCHAR", uchar);

export const SHORT = typedef("SHORT", short);
export const USHORT = typedef("USHORT", ushort);

export const INT = typedef("INT", int);
export const UINT = typedef("UINT", uint);

export const LONG = typedef("LONG", long);
export const ULONG = typedef("ULONG", ulong);

export const LONGLONG = typedef("LONGLONG", longlong);
export const ULONGLONG = typedef("ULONGLONG", ulonglong);

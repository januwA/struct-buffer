import { DOUBLE_TYPE, FLOAT_TYPE, registerType } from "./class-type";
export const int8_t = registerType(["int8_t", "__int8", "signed char", "char"], 1, false);
export const int16_t = registerType(["int16_t", "__int16", "short"], 2, false);
export const int32_t = registerType(["int32_t", "__int32", "int", "signed"], 4, false);
export const int64_t = registerType(["int64_t", "__int64", "long long", "signed long long"], 8, false);
export const uint8_t = registerType(["uint8_t", "__uint8", "unsigned char", "uchar", "BYTE"], 1, true);
export const uint16_t = registerType(["uint16_t", "__uint16", "unsigned short", "ushort", "WORD"], 2, true);
export const uint32_t = registerType(["uint32_t", "__uint32", "unsigned int", "uint", "DWORD"], 4, true);
export const uint64_t = registerType(["uint64_t", "__uint64", "unsigned long long", "ulonglong", "QWORD"], 8, true);
export const float = registerType([FLOAT_TYPE, "FLOAT"], 4, true);
export const double = registerType([DOUBLE_TYPE, "DOUBLE", "long double"], 8, true);
//# sourceMappingURL=types.js.map
import { registerType } from "./class-type";

export const char = registerType("char", 1);
export const string_t = registerType("string_t", 1);

// Floating point / 浮点
export const float = registerType("float", 4);
export const double = registerType("double", 8);

// signed integer / 有符号整数
export const int8_t = registerType("int8_t", 1, false);
export const int16_t = registerType("int16_t", 2, false);
export const int32_t = registerType("int32_t", 4, false);
export const int64_t = registerType("int64_t", 8, false);

// unsigned integer / 无符号整数
export const BYTE = registerType("BYTE", 1);
export const WORD = registerType("WROD", 2);
export const DWORD = registerType("DWORD", 4);
export const QWORD = registerType("QWORD", 8);
export const uint8_t = registerType("uint8_t", 1);
export const uint16_t = registerType("uint16_t", 2);
export const uint32_t = registerType("uint32_t", 4);
export const uint64_t = registerType("uint64_t", 8);
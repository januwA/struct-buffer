import {
  DOUBLE_TYPE,
  FLOAT_TYPE,
  StringType,
  registerType,
} from "./class-type";

export const string_t = new StringType();

/**
 * 一个公开类型 = 一次 `registerType`; C / C++ / Windows 的别名收进 `names` 数组,
 * 不再各导出一个实例:
 *
 * - 同一 (size, unsigned) 组合的别名共用实例, `sizeof` 一类的遍历少走一半 StructType
 * - 有符号与无符号的 8 字节类型**必须**是两个实例 —— `typeHandle` 靠 `unsigned` 选
 *   `getBigInt64` / `getBigUint64`, 一旦共用就有一边符号是错的
 *
 * `int64_t` 之前是从 `longlong` typedef 来的, 而 `longlong` 没显式传 `unsigned`,
 * 落进默认的 `true` —— 于是 `int64_t` 实际是无符号的, 负数解出来是一大坨正数。
 * 现在两个 8 字节类型都显式传 `unsigned`。
 */
export const int8_t = registerType(
  ["int8_t", "__int8", "signed char", "char"],
  1,
  false
);

export const int16_t = registerType(["int16_t", "__int16", "short"], 2, false);

export const int32_t = registerType(
  ["int32_t", "__int32", "int", "signed"],
  4,
  false
);

export const int64_t = registerType(
  ["int64_t", "__int64", "long long", "signed long long"],
  8,
  false
);

export const uint8_t = registerType(
  ["uint8_t", "__uint8", "unsigned char", "uchar", "BYTE"],
  1,
  true
);

export const uint16_t = registerType(
  ["uint16_t", "__uint16", "unsigned short", "ushort", "WORD"],
  2,
  true
);

export const uint32_t = registerType(
  ["uint32_t", "__uint32", "unsigned int", "uint", "DWORD"],
  4,
  true
);

export const uint64_t = registerType(
  ["uint64_t", "__uint64", "unsigned long long", "ulonglong", "QWORD"],
  8,
  true
);

export const float = registerType([FLOAT_TYPE, "FLOAT"], 4, true);

export const double = registerType(
  [DOUBLE_TYPE, "DOUBLE", "long double"],
  8,
  true
);

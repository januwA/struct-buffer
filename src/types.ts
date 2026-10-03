import { registerType } from "./class-type";

/**
 * 结构体构造配置。
 *
 * 这里配了会让 `encode` / `decode` 的 `littleEndian` 形参失效。
 *
 * https://github.com/januwA/struct-buffer/issues/2
 */
export type StructBufferConfig = {
  littleEndian?: boolean;
};

/**
 * 类型就是**线上的字节形状**: `(size, unsigned, kind)` 三元组, 没有名字。
 *
 * C / C++ / Windows 的别名(`__int8`、`BYTE`、`DWORD`、`long long`...)对编解码毫无
 * 影响, 所以一个别名都不导出 —— 想表达"C 里的那个 int32_t", 直接用 `int32_t`。
 *
 * 有符号与无符号的 8 字节类型**必须**是两个实例: `unsigned` 决定用
 * `getBigInt64` 还是 `getBigUint64`, 共用就有一边符号是错的。
 * (`int64_t` 之前是从 `longlong` typedef 来的, 而 `longlong` 没显式传 `unsigned`,
 * 落进默认的 `true` —— 于是 `int64_t` 实际是无符号的, 负数解出来是一大坨正数。)
 *
 * 文本不是类型: 编码选择(UTF-8 / UTF-16LE / GBK / Big5 / Shift-JIS / codepage...)
 * 是协议属性而不是类型属性, 而本库一行编解码都没实现 —— `TextDecoder` / `TextEncoder`
 * 全程委托给平台, 所以"库里支持哪种编码"这个问题本身不成立。文本字段用 `blob(...)`
 * 拿 `Uint8Array`, 编码由调用方自己接。
 */
export const int8_t = registerType(1, false);

export const int16_t = registerType(2, false);

export const int32_t = registerType(4, false);

export const int64_t = registerType(8, false);

export const uint8_t = registerType(1, true);

export const uint16_t = registerType(2, true);

export const uint32_t = registerType(4, true);

export const uint64_t = registerType(8, true);

export const float = registerType(4, true, "float");

export const double = registerType(8, true, "float");
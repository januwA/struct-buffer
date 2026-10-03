import { registerType } from "./class-type";
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
//# sourceMappingURL=types.js.map
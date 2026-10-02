import { BoolType, uint8_t, uint32_t, sizeof, makeDataView } from "../src";

/**
 * `bool` / `BOOL` 已经不再内置: 一个布尔就是"底层整数非零即真", 宽度交给使用者选,
 * 所以只留 `BoolType` 本身(C 的 `bool` 取 1B, Windows 的 `BOOL` 取 4B)。
 */
const bool = new BoolType("bool", uint8_t);
const BOOL = new BoolType("BOOL", uint32_t);

describe("BoolType 测试", () => {
  it("encode", () => {
    expect(uint8_t.decode(bool.encode(2))).toBe(1);
    expect(uint8_t.decode(bool.encode(0))).toBe(0);
    expect(uint32_t.decode(BOOL.encode(2))).toBe(1);
    expect(uint32_t.decode(BOOL.encode(0))).toBe(0);

    expect(uint8_t.decode(bool[1].encode([2]))).toBe(1);
    expect(uint8_t.decode(bool[1].encode([0]))).toBe(0);
    expect(uint32_t.decode(BOOL[1].encode([2]))).toBe(1);
    expect(uint32_t.decode(BOOL[1].encode([0]))).toBe(0);
  });

  it("decode", () => {
    // bool 走 1B, BOOL 走 4B 大端
    expect(bool.decode(makeDataView([2]))).toBe(true);
    expect(bool.decode(makeDataView([0]))).toBe(false);

    expect(BOOL.decode(makeDataView([0, 0, 0, 2]))).toBe(true);
    expect(BOOL.decode(makeDataView([0, 0, 0, 0]))).toBe(false);

    expect(bool[2].decode(makeDataView([2, 0]))).toEqual([true, false]);
    expect(bool[2].decode(makeDataView([0, 2]))).toEqual([false, true]);
    expect(BOOL[2].decode(makeDataView([0, 0, 0, 2, 0, 0, 0, 0]))).toEqual([
      true,
      false,
    ]);
    expect(BOOL[2].decode(makeDataView([0, 0, 0, 0, 0, 0, 0, 2]))).toEqual([
      false,
      true,
    ]);
  });

  it("sizeof", () => {
    expect(sizeof(bool)).toBe(1);
    expect(sizeof(bool[2])).toBe(2);
    expect(sizeof(BOOL)).toBe(4);
    expect(sizeof(BOOL[2])).toBe(8);
  });
});

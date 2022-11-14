import { BOOL, bool, uchar, uint, pack } from "../src";

describe("bool and BOOL test", () => {
  it("encode", () => {
    expect(uchar.decode(bool.encode(2))).toBe(1);
    expect(uchar.decode(bool.encode(0))).toBe(0);
    expect(uint.decode(BOOL.encode(2))).toBe(1);
    expect(uint.decode(BOOL.encode(0))).toBe(0);

    expect(uchar.decode(bool[1].encode([2]))).toBe(1);
    expect(uchar.decode(bool[1].encode([0]))).toBe(0);
    expect(uint.decode(BOOL[1].encode([2]))).toBe(1);
    expect(uint.decode(BOOL[1].encode([0]))).toBe(0);
  });

  it("decode", () => {
    expect(bool.decode(pack("B", 2))).toBe(true);
    expect(bool.decode(pack("B", 0))).toBe(false);

    expect(BOOL.decode(pack("I", 2))).toBe(true);
    expect(BOOL.decode(pack("I", 0))).toBe(false);

    expect(bool[2].decode(pack("2B", 2, 0))).toEqual([true, false]);
    expect(bool[2].decode(pack("2B", 0, 2))).toEqual([false, true]);
    expect(BOOL[2].decode(pack("2I", 2, 0))).toEqual([true, false]);
    expect(BOOL[2].decode(pack("2I", 0, 2))).toEqual([false, true]);
  });

  it("byteLength", () => {
    expect(bool.byteLength).toBe(1);
    expect(bool[2].byteLength).toBe(2);
    expect(BOOL.byteLength).toBe(4);
    expect(BOOL[2].byteLength).toBe(8);
  });

  it("count", () => {
    // [0]
    expect(bool.count).toBe(1);

    // [0,0]
    expect(bool[2].count).toBe(2);

    // [[0,0], [0,0]]
    expect(BOOL[2][2].count).toBe(4);

    // [[[0,0], [0,0], [0,0]], [[0,0],[0,0],[0,0]]]
    expect(BOOL[2][3][2].count).toBe(12);
  });
});

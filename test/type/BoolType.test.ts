import { bool, BoolType, pack, sview, uint64_t } from "../../src";

describe("BoolType test", () => {
  const bool64 = new BoolType(uint64_t)[3];

  beforeAll(() => {});
  it("encode", () => {
    expect(sview(bool.encode(2))).toBe("01");
    expect(sview(bool.encode(0))).toBe("00");

    expect(sview(bool[1].encode([2]))).toBe("01");
    expect(sview(bool[1].encode([0]))).toBe("00");

    expect(sview(bool[3].encode([2n, 0n, 1]))).toBe("01 00 01");

    expect(sview(bool64.encode([true, 1n, 0n]))).toBe(
      sview(pack("3Q", 1, 1, 0))
    );
  });

  it("decode", () => {
    expect(bool.decode([2])).toBe(true);
    expect(bool.decode([0])).toBe(false);

    expect(bool[2].decode([2, 0])).toEqual([true, false]);
    expect(bool[2].decode([0, 2])).toEqual([false, true]);

    expect(bool64.decode(pack("3Q", 0n, 1n, 2n))).toEqual([false, true, true]);
  });

  it("byteLength", () => {
    expect(bool64.byteLength).toBe(24);
    expect(bool.byteLength).toBe(1);
    expect(bool[2].byteLength).toBe(2);
  });

  it("list", () => {
    const t = bool[2][3];

    const v = t.encode([0, 1, 1, 1, 1, 0] as any);
    const data = t.decode(v);

    expect(data).toEqual([
      [false, true, true],
      [true, true, false],
    ]);
  });
});

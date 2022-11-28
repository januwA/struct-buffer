import { double, sview, sbytes as b } from "../../src";

describe("DoubleType test", () => {
  beforeAll(() => {});
  it("encode and decode", () => {
    const doublenum = 1.2345;

    const v1 = double.encode(0),
      v2 = double.encode(doublenum),
      v3 = double[2].encode([doublenum, doublenum]),
      v4 = double[2][3].encode([
        doublenum,
        doublenum,
        doublenum,
        doublenum,
        doublenum,
        doublenum,
      ] as any);

    expect(sview(v1)).toBe("00 00 00 00 00 00 00 00");
    expect(sview(v2)).toBe("3f f3 c0 83 12 6e 97 8d");
    expect(sview(v3)).toBe(
      "3f f3 c0 83 12 6e 97 8d" + " 3f f3 c0 83 12 6e 97 8d"
    );

    expect(double.decode(v1)).toBe(0);
    expect(double.decode(v2)).toBe(doublenum);
    expect(double[2].decode(v3)).toEqual([doublenum, doublenum]);
    expect(double[2][3].decode(v4)).toEqual([
      [doublenum, doublenum, doublenum],
      [doublenum, doublenum, doublenum],
    ]);
  });

  it("byteLength", () => {
    expect(double.byteLength).toBe(8);
    expect(double[2].byteLength).toBe(8 * 2);
    expect(double[2][3].byteLength).toBe(8 * 2 * 3);
  });
});

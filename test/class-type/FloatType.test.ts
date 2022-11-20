import { float, sview, sbytes as b } from "../../src";

describe("FloatType test", () => {
  beforeAll(() => {});
  it("encode and decode", () => {
    const writeFloat = 1.2345;
    const readFloat = 1.2345000505447388;

    const v1 = float.encode(0),
      v2 = float.encode(writeFloat),
      v3 = float[2].encode([writeFloat, writeFloat]),
      v4 = float[2][3].encode([
        writeFloat,
        writeFloat,
        writeFloat,
        writeFloat,
        writeFloat,
        writeFloat,
      ] as any);

    expect(sview(v1)).toBe("00 00 00 00");
    expect(sview(v2)).toBe("3f 9e 04 19");
    expect(sview(v3)).toBe("3f 9e 04 19" + " 3f 9e 04 19");

    expect(float.decode(v1)).toBe(0);
    expect(float.decode(v2)).toEqual(readFloat);
    expect(float[2].decode(v3)).toEqual([readFloat, readFloat]);
    expect(float[2][3].decode(v4)).toEqual([
      [readFloat, readFloat, readFloat],
      [readFloat, readFloat, readFloat],
    ]);
  });

  it("byteLength", () => {
    expect(float.byteLength).toBe(4);
    expect(float[2].byteLength).toBe(4 * 2);
    expect(float[2][3].byteLength).toBe(4 * 2 * 3);
  });
});

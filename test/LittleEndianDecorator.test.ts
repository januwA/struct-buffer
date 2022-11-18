import { StructBuffer, uint16_t, sview, LittleEndianDecorator } from "../src";

describe("LittleEndianDecorator", () => {
  it("struct", () => {
    const s = new StructBuffer({
      a: uint16_t,
      // b: new StructBuffer({
      //   c: uint16_t,
      //   d: uint16_t,
      // }),

      b: new LittleEndianDecorator(
        new StructBuffer({
          c: uint16_t,
          d: uint16_t,
        }),
        true
      ),
    });

    const view = s.encode(
      {
        a: 1,
        b: {
          c: 2,
          d: 3,
        },
      },
      {
        littleEndian: false,
      }
    );
    expect(sview(view)).toBe("00 01 02 00 03 00");

    const obj = s.decode(view);
    expect([obj.a, obj.b.c, obj.b.d]).toEqual([1, 2, 3]);
  });

  it("type", () => {
    const s = new StructBuffer({
      a: uint16_t,
      // b: uint16_t[2],
      b: new LittleEndianDecorator(uint16_t[2], true),
    });

    const view = s.encode(
      { a: 1, b: [2, 3] },
      {
        littleEndian: false,
      }
    );
    expect(sview(view)).toBe("00 01 02 00 03 00");

    const obj = s.decode(view);
    expect([obj.a, obj.b]).toEqual([1, [2, 3]]);
  });
});

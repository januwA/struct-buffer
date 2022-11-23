import { StructBuffer, uint16_t, sview, LittleEndian } from "../../src";

describe("LittleEndian", () => {
  it("struct", () => {
    const s = new StructBuffer({
      a: uint16_t,
      // b: new StructBuffer({
      //   c: uint16_t,
      //   d: uint16_t,
      // }),

      b: new LittleEndian(
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
      // b: new LittleEndianDecorator(uint16_t[2], true),
      b: new LittleEndian(uint16_t, true)[2],
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

  it("type 2", () => {
    const s = new StructBuffer({
      a: uint16_t,
      b: new LittleEndian(uint16_t, false)[2],
    });

    const opt = {
      littleEndian: true,
    };

    const view = s.encode({ a: 1, b: [2, 3] }, opt);
    expect(sview(view)).toBe("01 00 00 02 00 03");

    const obj = s.decode(view, opt);
    expect([obj.a, obj.b]).toEqual([1, [2, 3]]);
  });

  it("array", () => {
    const any_t = new LittleEndian(uint16_t, true);
    const view = any_t[2].encode([1, 2]);
    expect(sview(view)).toBe("01 00 02 00");
  });
});

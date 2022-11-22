import {
  StructBuffer,
  uint16_t,
  sview,
  RelativeOffsetDecorator,
  uint8_t,
} from "../../src";

describe("RelativeOffsetDecorator", () => {
  it("byteLength", () => {
    let t: any;

    t = new RelativeOffsetDecorator(uint16_t, 2);
    expect(t.byteLength).toBe(uint16_t.byteLength + 2);

    t = new RelativeOffsetDecorator(uint16_t[2], 2);
    expect(t.byteLength).toBe(uint16_t[2].byteLength + 2);

    t = new RelativeOffsetDecorator(uint16_t, 2)[2];
    expect(t.byteLength).toBe((uint16_t.byteLength + 2) * 2);

    t = new RelativeOffsetDecorator(
      new RelativeOffsetDecorator(uint16_t, 2),
      2
    )[3];
    expect(t.byteLength).toBe((uint16_t.byteLength + 2 + 2) * 3);
  });

  it("struct", () => {
    const s = new StructBuffer({
      a: uint16_t,
      b: new RelativeOffsetDecorator(
        new StructBuffer({
          c: uint16_t,
          d: uint16_t,
        }),
        2
      ),
    });

    const view = s.encode({
      a: 1,
      b: {
        c: 2,
        d: 3,
      },
    });
    expect(sview(view)).toBe("00 01 00 00 00 02 00 03");

    const obj = s.decode(view);
    expect([obj.a, obj.b.c, obj.b.d]).toEqual([1, 2, 3]);
  });

  it("type", () => {
    const s = new StructBuffer({
      a: uint16_t,
      b: new RelativeOffsetDecorator(uint16_t[2], 2),
      c: new RelativeOffsetDecorator(uint16_t, 2)[2],
    });

    expect(s.byteLength).toBe(
      // a
      uint16_t.byteLength +
        // b
        2 +
        uint16_t[2].byteLength +
        //c
        (2 + uint16_t.byteLength) * 2
    );

    const data = { a: 1, b: [2, 3], c: [4, 5] };
    const view = s.encode(data);
    expect(sview(view)).toBe(
      "00 01" + " 00 00 00 02 00 03" + " 00 00 00 04 00 00 00 05"
    );

    const obj = s.decode(view);
    expect(obj).toEqual(data);
  });

  it("array", () => {
    const any_t = new RelativeOffsetDecorator(uint8_t, 1)[2][3];
    const data = [
      [1, 2, 3],
      [4, 5, 6],
    ];
    const view = any_t.encode(data);

    expect(any_t.byteLength).toBe(2 * 6);
    expect(sview(view)).toBe("00 01 00 02 00 03 00 04 00 05 00 06");
    expect(any_t.decode(view)).toEqual(data);
  });
});

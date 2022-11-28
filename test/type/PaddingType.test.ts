import { padding_t, StructBuffer, sview, uint16_t, uint32_t } from "../../src";

describe("padding_t", () => {
  it("encode and decode", () => {
    const s = new StructBuffer({
      hp: uint16_t,
      padding1: padding_t[2],
      mp: uint32_t,
    });

    const view = s.encode({
      hp: 1,
      mp: 2,
    });

    expect(sview(view)).toBe("00 01 00 00 00 00 00 02");

    const obj = s.decode(view);
    expect([obj.hp, obj.mp]).toEqual([1, 2]);
    expect(obj.padding1).toEqual([0, 0]);
  });

  it("list", () => {
    const t = padding_t[2][2];

    const view = t.encode(1 as any);
    expect(sview(view)).toBe("01 01 01 01");

    const data = t.decode(view);

    expect(data).toEqual([
      [1, 1],
      [1, 1],
    ]);

    expect(padding_t[2].decode([1, 2, 3])).toEqual([1, 2]);
  });
});

import { padding_t, StructBuffer, sview, uint16_t, uint32_t } from "../src";

describe("padding_t", () => {
  it("padding_t", () => {
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
});

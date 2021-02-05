import { pack, unpack, sbytes as b, calcsize, sview } from "../src";

describe("py-struct test", () => {
  it("calcsize", () => {
    expect(calcsize("bb3x")).toBe(5);
    expect(calcsize("hhl")).toBe(8);
    expect(calcsize("2i")).toBe(8);
  });

  it("unpack", () => {
    expect(unpack("b2xb", b("02 00 00 01"))).toEqual([2, 1]);
    expect(unpack("b3s", b("02 61 62 63"))).toEqual([2, "abc"]);
    expect(unpack("<2i", b("ff ff ff ff 02 00 00 00"))).toEqual([-1, 2]);
    expect(unpack(">2i", b("ff ff ff ff 00 00 00 02"))).toEqual([-1, 2]);
    expect(unpack("2i", b("ff ff ff ff 00 00 00 02"))).toEqual([-1, 2]);
  });

  it("pack", () => {
    expect(sview(pack("b2xb", 2, 1))).toBe("02 00 00 01");
    expect(sview(pack("<b3s", 2, "abc"))).toBe("02 61 62 63");
    expect(sview(pack("<2i", -1, 2))).toBe("ff ff ff ff 02 00 00 00");
    expect(sview(pack(">2i", -1, 2))).toBe("ff ff ff ff 00 00 00 02");
    expect(sview(pack("2i", -1, 2))).toBe("ff ff ff ff 00 00 00 02");
  });

  it("player", () => {
    const [hp, mp, name] = unpack(
      ">II3s",
      b("00 00 00 64 00 00 00 0A 61 62 63")
    );
    expect(hp).toBe(100);
    expect(mp).toBe(10);
    expect(name).toBe("abc");
  });
});

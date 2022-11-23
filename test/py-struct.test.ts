import {
  pack,
  unpack,
  sbytes as b,
  calcsize,
  sview,
  pack_into,
  createDataView,
  iter_unpack,
  Struct,
} from "../src";

describe("py-struct test", () => {
  it("calcsize", () => {
    expect(calcsize("bb3x")).toBe(5);
    expect(calcsize("hhl")).toBe(8);
    expect(calcsize(">2i")).toBe(8);
  });

  it("unpack", () => {
    expect(unpack("b2xb", b("02 00 00 01"))).toEqual([2, 1]);
    expect(unpack("b3s", b("02 61 62 63"))).toEqual([2, "abc"]);
    expect(unpack("<2i", b("ff ff ff ff 02 00 00 00"))).toEqual([-1, 2]);
    expect(unpack(">2i", b("ff ff ff ff 00 00 00 02"))).toEqual([-1, 2]);
    expect(unpack("2i", b("ff ff ff ff 00 00 00 02"))).toEqual([-1, 2]);
    expect(unpack("??", b("01 00"))).toEqual([true, false]);
    expect(unpack("2?", b("01 00"))).toEqual([true, false]);
  });

  it("pack", () => {
    expect(sview(pack("b2xb", 2, 1))).toBe("02 00 00 01");
    expect(sview(pack("<b3s", 2, "abc"))).toBe("02 61 62 63");
    expect(sview(pack("<2i", -1, 2))).toBe("ff ff ff ff 02 00 00 00");
    expect(sview(pack(">2i", -1, 2))).toBe("ff ff ff ff 00 00 00 02");
    expect(sview(pack("2i", -1, 2))).toBe("ff ff ff ff 00 00 00 02");
  });

  it("pack_into", () => {
    const buf = createDataView(10);
    pack_into("b2xb", buf, 0, 2, 1);
    expect(sview(buf).startsWith("02 00 00 01")).toBe(true);

    pack_into("<b3s", buf, 0, 2, "abc");
    expect(sview(buf).startsWith("02 61 62 63")).toBe(true);

    pack_into("<2i", buf, 0, -1, 2);
    expect(sview(buf).startsWith("ff ff ff ff 02 00 00 00")).toBe(true);

    pack_into(">2i", buf, 0, -1, 2);
    expect(sview(buf).startsWith("ff ff ff ff 00 00 00 02")).toBe(true);

    pack_into("2i", buf, 0, -1, 2);
    expect(sview(buf).startsWith("ff ff ff ff 00 00 00 02")).toBe(true);
  });

  it("iter_unpack", () => {
    const r = iter_unpack("2b", b("01 02 03 04"));
    expect(r.next().value).toEqual([1, 2]);
    expect(r.next().value).toEqual([3, 4]);
    expect(r.next().done).toBe(true);
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

describe("Struct test", () => {
  const strct = new Struct(">2i");

  it("calcsize", () => {
    expect(strct.size).toBe(8);
  });

  it("unpack", () => {
    expect(strct.unpack(b("ff ff ff ff 00 00 00 02"))).toEqual([-1, 2]);
  });

  it("pack", () => {
    expect(sview(strct.pack(-1, 2))).toBe("ff ff ff ff 00 00 00 02");
  });

  it("pack_into", () => {
    const buf = createDataView(10);
    strct.pack_into(buf, 0, -1, 2);
    expect(sview(buf).startsWith("ff ff ff ff 00 00 00 02")).toBe(true);
  });

  it("iter_unpack", () => {
    const r = strct.iter_unpack(pack("5i", 1, 2, 3, 4, 5));
    expect(r.next().value).toEqual([1, 2]);
    expect(r.next().value).toEqual([3, 4]);
    expect(r.next().done).toBe(true);
  });
});

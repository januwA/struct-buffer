import {
  createDataView,
  makeDataView,
  pack,
  sbytes as b,
  sbytes2 as b2,
  sview,
  TEXT,
} from "../src";

describe("utils test", () => {
  it("createDataView", () => {
    expect(sview(createDataView(3))).toBe("00 00 00");
  });

  it("makeDataView", () => {
    expect(sview(makeDataView([1, 2, 3]))).toBe("01 02 03");
    expect(sview(makeDataView(Uint8Array.from([1, 2, 3])))).toBe("01 02 03");
  });

  it("sbytes", () => {
    expect(sview(b("01 02 03"))).toBe("01 02 03");
    expect(sview(b("010203"))).toBe("01 02 03");
    expect(sview(b("0x01\\x02 03h"))).toBe("01 02 03");
  });

  it("sbytes2 parse string", () => {
    expect(sview(b2("abc\\x1\\x2\\x3"))).toBe("61 62 63 01 02 03");
  });

  it("TEXT", () => {
    const view: DataView = pack("3s2b3s2I", "abc", 1, 2, "xyz", 8, 9);
    expect(TEXT(view)).toBe("abc..xyz........");
    expect(
      TEXT(view, (byte: number) => {
        return " " + byte.toString(16).padStart(2, "0");
      })
    ).toBe("abc 01 02xyz 00 00 00 08 00 00 00 09");
    expect(TEXT(view, "^")).toBe("abc^^xyz^^^^^^^^");
  });
});

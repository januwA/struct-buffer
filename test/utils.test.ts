import {
  createDataView,
  makeDataView,
  pack,
  sbytes as b,
  sbytes2 as b2,
  sview,
  TEXT,
  realloc,
  uint8_t,
  uint64_t,
  float,
  double,
} from "../src";

import { zeroMemory, typeHandle } from "../src/utils";

describe("utils test", () => {
  it("createDataView", () => {
    expect(sview(createDataView(3))).toBe("00 00 00");
  });

  it("makeDataView", () => {
    expect(sview(makeDataView(pack("3B", 1, 2, 3)))).toBe("01 02 03");
    expect(sview(makeDataView([1, 2, 3]))).toBe("01 02 03");
    expect(sview(makeDataView(Uint8Array.from([1, 2, 3])))).toBe("01 02 03");
  });

  it("sbytes", () => {
    expect(sview(b("01 02 03"))).toBe("01 02 03");
    expect(sview(b("010203"))).toBe("01 02 03");
    expect(sview(b("010  20   34"))).toBe("01 02 03");
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

  it("zeroMemory", () => {
    const v: DataView = pack("4B", 1, 2, 3, 4);
    zeroMemory(v, 4, 0);

    expect(sview(v)).toBe("00 00 00 00");
  });

  it("realloc", () => {
    // copy
    let mem = pack("3B", 1, 2, 3);
    const newMemSize = 6;
    let newMem = realloc(mem, newMemSize);
    expect(sview(newMem)).toBe("01 02 03 00 00 00");
    expect(mem !== newMem).toBe(true);

    // copy and push
    const pushMem = pack("3B", 3, 2, 1);
    const pushOffset = 3;
    newMem = realloc(mem, newMemSize, pushMem, pushOffset);
    expect(sview(newMem)).toBe("01 02 03 03 02 01");
    expect(mem !== newMem).toBe(true);
  });

  it("typeHandle", () => {
    expect(typeHandle(uint8_t)).toEqual(["getUint8", "setUint8"]);
    expect(typeHandle(uint64_t)).toEqual(["getBigUint64", "setBigUint64"]);
    expect(typeHandle(float)).toEqual(["getFloat32", "setFloat32"]);
    expect(typeHandle(double)).toEqual(["getFloat64", "setFloat64"]);
  });
});

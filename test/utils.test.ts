import {
  DynamicStructBuffer,
  createDataView,
  makeDataView,
  pack,
  sbytes as b,
  sbytes2 as b2,
  sview,
  TEXT,
  uint8_t,
} from "../src";

describe("utils test", () => {
  it("createDataView", () => {
    expect(sview(createDataView(3))).toBe("00 00 00");
  });

  it("makeDataView", () => {
    expect(sview(makeDataView([1, 2, 3]))).toBe("01 02 03");
    expect(sview(makeDataView(Uint8Array.from([1, 2, 3])))).toBe("01 02 03");
  });

  it("makeDataView 尊重 subarray 窗口(别读出去)", () => {
    const whole = Uint8Array.from([0xaa, 0xbb, 1, 2, 3, 0xcc]);
    // 非零 byteOffset: 必须从窗口起点读, 而不是整块 buffer 的 0
    expect(sview(makeDataView(whole.subarray(2, 5)))).toBe("01 02 03");
    // 长度受限: 窗口外的字节不能进来
    const win = makeDataView(whole.subarray(0, 3));
    expect(win.byteOffset).toBe(0);
    expect(win.byteLength).toBe(3);
    expect(() => new Uint8Array(win.buffer, win.byteOffset + 3, 1)[0]).not.toThrow();
    // 端到端: decode 只看窗口里的字节
    const S = new DynamicStructBuffer("s", { a: uint8_t, b: uint8_t, c: uint8_t });
    expect(S.decode(whole.subarray(0, 3))).toEqual({ a: 0xaa, b: 0xbb, c: 1 });
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

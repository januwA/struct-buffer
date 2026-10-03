import { sview, uint16_t, struct } from "../src";

// https://github.com/januwA/struct-buffer/issues/2

describe("littleEndian 配置", () => {
  it("littleEndian: 配置优先于参数", () => {
    const Inner = struct(
      "test2",
      {
        ip: uint16_t,
        port: uint16_t,
      },
      {
        littleEndian: false,
      }
    );

    const s = struct(
      "test",
      {
        a: uint16_t,
        b: uint16_t,
        c: Inner,
      },
      {
        littleEndian: true,
      }
    );

    const v = s.encode({
      a: 1,
      b: 2,
      c: {
        ip: 10,
        port: 100,
      },
    });
    expect(sview(v)).toBe("01 00 02 00 00 0a 00 64");
  });
});

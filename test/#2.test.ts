import { StructBuffer, sview, uint16_t } from "../src";

// https://github.com/januwA/struct-buffer/issues/2

describe("debug", () => {
  it("littleEndian: 配置优先于参数", () => {
    const s = new StructBuffer(
      "test",
      {
        a: uint16_t,
        b: uint16_t,
        c: new StructBuffer(
          "test2",
          {
            ip: uint16_t,
            port: uint16_t,
          },
          {
            littleEndian: false,
          }
        ),
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

  it("test extends", () => {
    class X extends StructBuffer {
      a = 10;
    }

    let s = new X("s", {})[2][2] as any;
    expect(s.a).toBe(10);
  });
});

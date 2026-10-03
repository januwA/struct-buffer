import { DynamicStructBuffer, sview, uint16_t } from "../src";

// https://github.com/januwA/struct-buffer/issues/2

describe("littleEndian 配置", () => {
  it("littleEndian: 配置优先于参数", () => {
    const s = new DynamicStructBuffer(
      "test",
      {
        a: uint16_t,
        b: uint16_t,
        c: new DynamicStructBuffer(
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

  it("子类实例经下标后仍保留自有属性", () => {
    class X extends DynamicStructBuffer<any, any, any> {
      a = 10;
    }

    const s = new X("s", {})[2][2] as any;
    expect(s.a).toBe(10);
  });
});
import { uint32_t, sview, uint8_t, sbytes as b, bitFields, struct } from "../src";

// https://github.com/januwA/struct-buffer/issues/3

describe("test bitFields", () => {
  it("test 1", () => {
    const s = struct("test", {
      a: bitFields(uint8_t, {
        alpha: 2,
        beta: 4,
        gamma: 2,
      }),
      b: uint32_t,
    });

    const v = s.encode({
      a: {
        alpha: 1,
        beta: 2,
        gamma: 3,
      },
      b: 10,
    });
    expect(sview(v).toUpperCase()).toBe("C9 00 00 00 0A");

    const data = s.decode(b("C9 00 00 00 0A"));
    expect(data.a.alpha).toBe(1);
    expect(data.a.beta).toBe(2);
    expect(data.a.gamma).toBe(3);
    expect(data.b).toBe(10);
  });

  it("test 2", () => {
    const bf = bitFields(uint8_t, {
      a: 1,
      b: 2,
      c: 3,
    });

    const v = bf.encode({
      a: 1,
      b: 2,
      c: 3,
    });
    expect(sview(v).toUpperCase()).toBe("1D");

    const data = bf.decode(b("1D"));
    expect(data.a).toBe(1);
    expect(data.b).toBe(2);
    expect(data.c).toBe(3);
  });

  it("值放不进声明位宽就报错, 不再串到下一位", () => {
    const bf = bitFields(uint8_t, { a: 1, b: 1 });
    // 旧实现: a=2 的 bit1 溢出串到 b, a 解回来变 0, 静默写错
    expect(() => bf.encode({ a: 2, b: 0 })).toThrow(/放不进 1 位/);
  });

  it("位宽总和超过存储宽度在构造期报错", () => {
    expect(() => bitFields(uint8_t, { a: 7, b: 2 })).toThrow(/超过 8 位/);
    expect(() => bitFields(uint8_t, { a: 0 })).toThrow(/位宽/);
  });
});

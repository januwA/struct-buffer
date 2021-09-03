import { StructBuffer, uint32_t, sview, uint8_t, sbytes as b } from "../src";
import { bitFields } from "../src/class-type";

// https://github.com/januwA/struct-buffer/issues/3

describe("test bitFields", () => {
  it("test 1", () => {
    const s = new StructBuffer("test", {
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
});

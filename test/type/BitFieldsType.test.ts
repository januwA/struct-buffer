import {
  StructBuffer,
  uint32_t,
  sview,
  uint8_t,
  sbytes as b,
  bitFields,
} from "../../src";

// https://github.com/januwA/struct-buffer/issues/3

describe("test bitFields", () => {
  it("test 1", () => {
    const s = new StructBuffer({
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
    expect(sview(v)).toBe("1d");

    const data = bf.decode(v);
    expect([data.a, data.b, data.c]).toEqual([1, 2, 3]);
  });

  it("test list", () => {
    const bf = bitFields(uint8_t, {
      a: 1,
      b: 2,
      c: 3,
    })[2];

    const v = bf.encode([
      {
        a: 1,
        b: 2,
        c: 3,
      },
      {
        a: 1,
        b: 2,
        c: 3,
      },
    ]);
    expect(sview(v)).toBe("1d 1d");

    const data = bf.decode(v);

    expect(data.length).toBe(2);
    expect([data[0].a, data[0].b, data[0].c]).toEqual([1, 2, 3]);
    expect([data[1].a, data[1].b, data[1].c]).toEqual([1, 2, 3]);
  });
});

import { StructBuffer, sview, WORD } from "../src";

// https://github.com/januwA/struct-buffer/issues/2

describe("debug", () => {
  it("string_t", () => {
    const s = new StructBuffer({
      a: WORD,
      b: WORD,
      c: new StructBuffer({
        ip: WORD,
        port: WORD,
      }),
    });

    const obj = {
      a: 1,
      b: 2,
      c: {
        ip: 10,
        port: 100,
      },
    };

    const v1 = s.encode(obj, {
      littleEndian: false,
    });
    expect(sview(v1)).toBe("00 01 00 02 00 0a 00 64");

    const v2 = s.encode(obj, {
      littleEndian: true,
    });
    expect(sview(v2)).toBe("01 00 02 00 0a 00 64 00");
  });

  it("test extends", () => {
    class X extends StructBuffer {
      a = 10;
    }

    let s = new X({})[2][2] as any;
    expect(s.a).toBe(10);
  });
});

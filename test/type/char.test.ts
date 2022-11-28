import { char, StructBuffer, uchar, pack, sview, sbytes2 as b2 } from "../../src";

describe("test char", () => {
  it("test decode and encode", () => {
    const view = b2("abcd");
    const obj = {
      a: 0x61,
      b: [0x62],
      c: [0x63, 0x64],
    };
    let struct = new StructBuffer({
      a: char,
      b: char[1],
      c: char[2],
    });
    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(4);
  });

  it("test char and uchar", () => {
    const s = new StructBuffer({
      a: char,
      b: uchar,
    });
    const data = s.decode(pack("bb", -1, -1));
    expect(data).toEqual({
      a: -1,
      b: 255,
    });
  });
});

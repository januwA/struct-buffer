import { string_t, StructBuffer, sbytes2 as b2, sview } from "../../src";

describe("test string_t", () => {
  it("test decode and encode", () => {
    let struct = new StructBuffer({
      a: string_t,
      b: string_t,
      c: string_t[2],
    });
    const obj = {
      a: "a",
      b: "b",
      c: "cd",
    };
    const view = b2("abcd");
    expect(struct.decode(view)).toEqual(obj);

    expect(sview(struct.encode(obj))).toBe(sview(view));
    
    expect(struct.byteLength).toBe(4);
  });

  it("test names", () => {
    const t = string_t[3][4];
    const obj = ["abcd", "abce", "abcf"] as any;

    const view = t.encode(obj);

    const names = t.decode(view);

    expect(names).toEqual(obj);
  });
});

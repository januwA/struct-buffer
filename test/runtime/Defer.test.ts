import { IBufferLike } from "../../src/interfaces";
import { Defer, int16_t, sview } from "../../src";

describe("Defer test", () => {
  let t1: Defer<number, number>,
    t2: Defer<number[], number[]>,
    t3: IBufferLike<any, any>;

  beforeAll(() => {
    t1 = new Defer(() => int16_t);
    t2 = new Defer(() => int16_t[2]);
    t3 = new Defer(() => int16_t[2])[3]; //like: new Defer(() => int16_t[2][3])
  });

  it("byteLength", () => {
    expect(t1.byteLength).toBe(2);
    expect(t2.byteLength).toBe(4);
    expect(t3.byteLength).toBe(4 * 3);
  });

  it("decode and encode", () => {
    const d1 = 1,
      d2 = [1, 2],
      d3 = [[1, 2, 3], [4, 5, 6]];

    const v1 = t1.encode(d1),
      v2 = t2.encode(d2),
      v3 = t3.encode(d3);

    expect(sview(v1)).toBe("00 01");
    expect(sview(v2)).toBe("00 01 00 02");
    expect(sview(v3)).toBe("00 01 00 02 00 03 00 04 00 05 00 06");

    expect(t1.decode(v1)).toBe(d1);
    expect(t2.decode(v2)).toEqual(d2);
    expect(t3.decode(v3)).toEqual(d3);
    
  });
});

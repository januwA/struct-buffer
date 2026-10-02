import { BoolType, int32_t, string_t, StructBuffer } from "../src";
import { bits, BitsType, StringType, StructType } from "../src/class-type";

const BOOL = new BoolType("BOOL", int32_t);

describe("deeps test", () => {
  it("type", () => {
    let a = int32_t;
    let b = a[2];
    let c = b[3];
    expect(a.deeps).toEqual([]);
    expect(b.deeps).toEqual([2]);
    expect(c.deeps).toEqual([2, 3]);

    expect(a instanceof StructType).toEqual(true);
    expect(b instanceof StructType).toEqual(true);
    expect(c instanceof StructType).toEqual(true);

    expect(bits(int32_t, {})[2][2] instanceof BitsType).toEqual(true);
    expect(BOOL[2][2] instanceof BoolType).toEqual(true);
    expect(string_t[2][2] instanceof StringType).toEqual(true);
  });

  it("struct", () => {
    let a = new StructBuffer("a", {});
    let b = a[2];
    let c = b[3];
    expect(a.deeps).toEqual([]);
    expect(b.deeps).toEqual([2]);
    expect(c.deeps).toEqual([2, 3]);

    expect(a instanceof StructBuffer).toEqual(true);
    expect(b instanceof StructBuffer).toEqual(true);
    expect(c instanceof StructBuffer).toEqual(true);
  });
});

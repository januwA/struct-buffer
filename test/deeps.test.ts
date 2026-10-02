import { int32_t, uint8_t, StructBuffer } from "../src";
import { bits, bitFields, BitsType, BitFieldsType, StructType } from "../src/class-type";

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
    expect(bitFields(int32_t, {})[2][2] instanceof BitFieldsType).toEqual(true);
    expect(uint8_t[2][2] instanceof StructType).toEqual(true);
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

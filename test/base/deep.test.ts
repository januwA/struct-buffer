import {
  int32_t,
  padding_t,
  string_t,
  StructBuffer,
  uint8_t,
  bits,
  BitsType,
  PaddingType,
  StringType,
  StructType,
} from "../../src";

describe("deeps test", () => {
  it("type", () => {
    let a = int32_t;
    let b = a[2];
    let c = b[3];
    expect((a as any).deeps).toEqual([]);
    expect((b as any).deeps).toEqual([2]);
    expect((c as any).deeps).toEqual([2, 3]);
    expect(a instanceof StructType).toEqual(true);
    expect(b instanceof StructType).toEqual(true);
    expect(c instanceof StructType).toEqual(true);
    expect(padding_t[2][4] instanceof PaddingType).toEqual(true);
    expect(bits(int32_t, {})[2][2] instanceof BitsType).toEqual(true);
    expect(string_t[2][2] instanceof StringType).toEqual(true);
  });
  it("struct", () => {
    let a = new StructBuffer({});
    let b = a[2];
    let c = b[3];
    expect((a as any).deeps).toEqual([]);
    expect((b as any).deeps).toEqual([2]);
    expect((c as any).deeps).toEqual([2, 3]);
    expect(a instanceof StructBuffer).toEqual(true);
    expect(b instanceof StructBuffer).toEqual(true);
    expect(c instanceof StructBuffer).toEqual(true);
  });

  it("deeps length", () => {
    const type = uint8_t[2][3][4];
    const obj = type.decode(new Array(type.length).fill(1));
    // console.log(obj);

    expect(obj.length).toBe(2);
    expect(obj[0].length).toBe(3);
    expect(obj[0][0].length).toBe(4);
  });
});

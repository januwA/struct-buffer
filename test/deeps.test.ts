import { BOOL, int32_t, padding_t, string_t, StructBuffer } from "../src";
import {
  bits,
  BitsType,
  BoolType,
  PaddingType,
  StringType,
  StructType,
} from "../src/class-type";

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
    expect(BOOL[2][2] instanceof BoolType).toEqual(true);
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
});

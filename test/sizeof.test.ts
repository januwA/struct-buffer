import {
  string_t,
  uint8_t,
  uint16_t,
  uint32_t,
  uint64_t,
  int8_t,
  int16_t,
  int32_t,
  int64_t,
  float,
  double,
  sizeof,
  StructBuffer,
} from "../src";

describe("test sizeof", () => {
  it("test uint8_t", () => {
    expect(sizeof(uint8_t)).toBe(1);
    expect(sizeof(uint8_t[10])).toBe(10);
    expect(sizeof(uint8_t[1][1])).toBe(1);
  });

  it("test uint16_t", () => {
    expect(sizeof(uint16_t)).toBe(2);
    expect(sizeof(uint16_t[10])).toBe(20);
    expect(sizeof(uint16_t[3][4])).toBe(24);
  });

  it("test uint32_t", () => {
    expect(sizeof(uint32_t)).toBe(4);
    expect(sizeof(uint32_t[10])).toBe(40);
    expect(sizeof(uint32_t[2][4])).toBe(32);
  });

  it("test uint64_t", () => {
    expect(sizeof(uint64_t)).toBe(8);
    expect(sizeof(uint64_t[10])).toBe(80);
  });

  it("test int8_t", () => {
    expect(sizeof(int8_t)).toBe(1);
    expect(sizeof(int8_t[10])).toBe(10);
  });

  it("test int16_t", () => {
    expect(sizeof(int16_t)).toBe(2);
    expect(sizeof(int16_t[10])).toBe(20);
  });

  it("test int32_t", () => {
    expect(sizeof(int32_t)).toBe(4);
    expect(sizeof(int32_t[10])).toBe(4 * 10);
  });

  it("test int64_t", () => {
    expect(sizeof(int64_t)).toBe(8);
    expect(sizeof(int64_t[10])).toBe(8 * 10);
  });

  it("test float", () => {
    expect(sizeof(float)).toBe(4);
    expect(sizeof(float[10])).toBe(4 * 10);
  });

  it("test double", () => {
    expect(sizeof(double)).toBe(8);
    expect(sizeof(double[10])).toBe(8 * 10);
  });

  it("test string_t", () => {
    expect(sizeof(string_t)).toBe(1);
    expect(sizeof(string_t[10])).toBe(10);
  });

  it("同名别名与固定宽度类型是同一个实例", () => {
    // C / Windows 别名收进 names, 不再各导出一个实例
    expect(uint8_t.names).toContain("BYTE");
    expect(uint16_t.names).toContain("WORD");
    expect(uint32_t.names).toContain("DWORD");
    expect(uint64_t.names).toContain("QWORD");

    // char 在 x86/ARM 上默认有符号, 和 unsigned char 分属两侧
    expect(int8_t.names).toContain("char");
    expect(uint8_t.names).toContain("unsigned char");
    expect(uint8_t.names).toContain("uchar");
  });

  it("有符号与无符号的 8 字节类型必须是两个实例", () => {
    // typeHandle 靠 unsigned 选 getBigInt64 / getBigUint64,
    // 共用一个实例就有一边符号是错的
    expect(int64_t).not.toBe(uint64_t);
    expect(int64_t.unsigned).toBe(false);
    expect(uint64_t.unsigned).toBe(true);
  });

  it("test struct", () => {
    expect(
      sizeof(
        new StructBuffer("Test", {
          a: uint32_t,
          b: uint8_t,
        })
      )
    ).toBe(8);

    expect(
      sizeof(
        new StructBuffer("Test", {
          a: uint8_t[5],
          b: uint8_t,
        })
      )
    ).toBe(6);

    expect(
      sizeof(
        new StructBuffer("Test", {
          a: uint64_t,
          b: uint16_t,
          c: uint8_t,
        })
      )
    ).toBe(16);

    const A = new StructBuffer("Test", {
      a: uint64_t,
      b: uint8_t,
    });
    const B = new StructBuffer("Test", {
      a: uint32_t,
      b: A,
      c: uint8_t,
    });
    expect(B.maxSize).toBe(8);
    expect(B.byteLength).toBe(14);
    expect(sizeof(B)).toBe(16);
    expect(sizeof(B[2][2][2])).toBe(128);
  });

  it("test struct Multilevel array", () => {
    const s = new StructBuffer("Test", {
      hp: uint32_t,
      isJump: uint8_t,
    });
    expect(sizeof(s)).toBe(8);
    expect(sizeof(s[2])).toBe(16);
    expect(sizeof(s[2][2])).toBe(32);
    expect(sizeof(s[2][2][2])).toBe(64);
  });
});
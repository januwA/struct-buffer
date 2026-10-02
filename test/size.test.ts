import {
  blob,
  DynamicStructBuffer,
  double,
  float,
  int16_t,
  int32_t,
  int64_t,
  int8_t,
  uint16_t,
  uint32_t,
  uint64_t,
  uint8_t,
  ref,
} from "../src";

/**
 * 尺寸模型。
 *
 * 旧 API 是自由函数 `sizeof(type)`, 现在拆成两处, 各自只有一个算法来源:
 *
 * - `StructType.getSize(ctx?)` —— 单个类型(含下标展开)的字节数
 * - `DynamicStructBuffer.getByteLength(obj?)` —— 整个结构体; 全定长时不需要样本对象,
 *   有变长字段时**直接把对象 encode 一遍量出来**, 而不是另写一套尺寸推算
 *
 * 注意不再有"按 maxSize 对齐"这一说 —— 见文件末尾那条用例。
 */
describe("test size", () => {
  it("uint8_t", () => {
    expect(uint8_t.getSize()).toBe(1);
    expect(uint8_t[10].getSize()).toBe(10);
    expect(uint8_t[1][1].getSize()).toBe(1);
  });

  it("uint16_t", () => {
    expect(uint16_t.getSize()).toBe(2);
    expect(uint16_t[10].getSize()).toBe(20);
    expect(uint16_t[3][4].getSize()).toBe(24);
  });

  it("uint32_t", () => {
    expect(uint32_t.getSize()).toBe(4);
    expect(uint32_t[10].getSize()).toBe(40);
    expect(uint32_t[2][4].getSize()).toBe(32);
  });

  it("uint64_t", () => {
    expect(uint64_t.getSize()).toBe(8);
    expect(uint64_t[10].getSize()).toBe(80);
  });

  it("int8_t", () => {
    expect(int8_t.getSize()).toBe(1);
    expect(int8_t[10].getSize()).toBe(10);
  });

  it("int16_t", () => {
    expect(int16_t.getSize()).toBe(2);
    expect(int16_t[10].getSize()).toBe(20);
  });

  it("int32_t", () => {
    expect(int32_t.getSize()).toBe(4);
    expect(int32_t[10].getSize()).toBe(4 * 10);
  });

  it("int64_t", () => {
    expect(int64_t.getSize()).toBe(8);
    expect(int64_t[10].getSize()).toBe(8 * 10);
  });

  it("float", () => {
    expect(float.getSize()).toBe(4);
    expect(float[10].getSize()).toBe(4 * 10);
  });

  it("double", () => {
    expect(double.getSize()).toBe(8);
    expect(double[10].getSize()).toBe(8 * 10);
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

  it("结构体: 字段相加", () => {
    const Test = new DynamicStructBuffer("Test", {
      a: uint32_t,
      b: uint8_t,
    });
    expect(Test.getByteLength()).toBe(5);

    const Test2 = new DynamicStructBuffer("Test", {
      a: uint8_t[5],
      b: uint8_t,
    });
    expect(Test2.getByteLength()).toBe(6);
  });

  it("结构体: 嵌套结构体不加对齐", () => {
    const A = new DynamicStructBuffer("A", {
      a: uint64_t,
      b: uint8_t,
    });
    const B = new DynamicStructBuffer("B", {
      a: uint32_t,
      b: A,
      c: uint8_t,
    });
    // 4 + 9 + 1 = 14 —— 嵌套结构体按自己的实际宽度计入
    expect(B.getByteLength()).toBe(14);
    // 尺寸必须与 encode 实际产出一致, 否则用户按 size 切片就会错位
    expect(B.encode({ a: 1, b: { a: 2, b: 3 }, c: 4 }).byteLength).toBe(14);
  });

  it("结构体: 多维下标", () => {
    const s = new DynamicStructBuffer("Test", {
      hp: uint32_t,
      isJump: uint8_t,
    });
    expect(s.getByteLength()).toBe(5);
    expect(s[2].getByteLength()).toBe(10);
    expect(s[2][2].getByteLength()).toBe(20);
    expect(s[2][2][2].getByteLength()).toBe(40);

    const obj = { hp: 1, isJump: 2 };
    const row = [obj, obj];
    const grid = [row, row];
    expect(
      s[2][2][2].encode([grid, grid]).byteLength
    ).toBe(8 * 5);
  });

  it("变长字段必须给样本对象, 尺寸靠 encode 量出来", () => {
    const s = new DynamicStructBuffer("Test", {
      n: uint8_t,
      p: blob(ref("n")),
    });

    // 全定长字段才允许不带对象问尺寸
    const fixed = new DynamicStructBuffer("Test", {
      a: uint32_t,
      b: uint8_t,
    });
    expect(fixed.getByteLength()).toBe(5);
    expect(() => s.getByteLength()).toThrow();

    // 变长字段的尺寸不另写一套推算, 直接 encode 一遍量出来 —— 所以不会与实际产出不一致
    expect(s.getByteLength({ n: 3, p: new Uint8Array(3) })).toBe(4);
    expect(s.getByteLength({ n: 10, p: new Uint8Array(10) })).toBe(11);
    expect(
      s.encode({ n: 3, p: new Uint8Array([1, 2, 3]) }).byteLength
    ).toBe(4);
  });
});
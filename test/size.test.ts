import {
  bytes,
  double,
  float,
  int16_t,
  int32_t,
  int64_t,
  int8_t,
  list,
  ref,
  registerType,
  struct,
  sview,
  uint16_t,
  uint32_t,
  uint64_t,
  uint8_t,
} from "../src";

/**
 * 尺寸模型。
 *
 * 单类型尺寸就是标量的 `size`, 列表/字节段的尺寸由 `encode(...).byteLength` 量出来
 * —— 同一个算法来源, 不再另写一套尺寸推算。结构体尺寸 = 各字段尺寸之和(不加对齐)。
 */
describe("test size", () => {
  const zeros = (n: number) => Array(n).fill(0);

  it("标量 size 只看字节形状", () => {
    expect(uint8_t.size).toBe(1);
    expect(uint16_t.size).toBe(2);
    expect(uint32_t.size).toBe(4);
    expect(uint64_t.size).toBe(8);
    expect(int8_t.size).toBe(1);
    expect(int16_t.size).toBe(2);
    expect(int32_t.size).toBe(4);
    expect(int64_t.size).toBe(8);
    expect(float.size).toBe(4);
    expect(double.size).toBe(8);
  });

  it("列表宽度 = 元素宽度 * 个数", () => {
    expect(list(uint8_t, 10).encode(zeros(10)).byteLength).toBe(10);
    expect(list(uint16_t, 10).encode(zeros(10)).byteLength).toBe(20);
    expect(list(uint32_t, 2).encode(zeros(2)).byteLength).toBe(8);
    expect(list(uint64_t, 10).encode(zeros(10)).byteLength).toBe(80);
    expect(list(int8_t, 10).encode(zeros(10)).byteLength).toBe(10);
    expect(list(int16_t, 10).encode(zeros(10)).byteLength).toBe(20);
    expect(list(int32_t, 10).encode(zeros(10)).byteLength).toBe(4 * 10);
    expect(list(int64_t, 10).encode(zeros(10)).byteLength).toBe(8 * 10);
    expect(list(float, 10).encode(zeros(10)).byteLength).toBe(4 * 10);
    expect(list(double, 10).encode(zeros(10)).byteLength).toBe(8 * 10);
    expect(list(list(uint16_t, 4), 3).encode([zeros(4), zeros(4), zeros(4)]).byteLength).toBe(24);
  });

  it("访问器由字节形状决定, 不看名字", () => {
    expect(int8_t.get).toBe("getInt8");
    expect(uint8_t.get).toBe("getUint8");
    expect(uint16_t.get).toBe("getUint16");
    expect(int32_t.get).toBe("getInt32");
    expect(float.get).toBe("getFloat32");
    expect(double.get).toBe("getFloat64");
  });

  it("有符号与无符号的 8 字节类型必须是两个实例", () => {
    // 8 字节整数走 BigInt 访问器, 由 unsigned 决定是哪一支;
    // 共用一个实例就有一边符号是错的
    expect(int64_t.get).toBe("getBigInt64");
    expect(uint64_t.get).toBe("getBigUint64");
    expect(int64_t).not.toBe(uint64_t);
    expect(int64_t.unsigned).toBe(false);
    expect(uint64_t.unsigned).toBe(true);
  });

  it("自定义浮点类型按浮点读写", () => {
    // 过去 kind 是靠"名字里有没有 float"猜的, 所以任何 float 的别名都会掉队:
    // size=4 + unsigned=true 只能落到 getUint32, 1.5 被静默编成 00 00 00 01 ——
    // 不报错, 字节还合法。现在浮点身份由 kind 携带, 与名字无关
    const my_float = registerType(4, true, "float");

    expect(my_float.kind).toBe("float");
    expect(my_float.get).toBe("getFloat32");
    expect(sview(my_float.encode(1.5))).toBe("3f c0 00 00");
    expect(my_float.decode(my_float.encode(1.5))).toBe(1.5);
  });

  it("不存在的字节形状要当场报错", () => {
    // 浮点没有 2 字节形态, 整数也没有 3 字节形态
    expect(() => registerType(2, true, "float")).toThrow(/字节形状/);
    expect(() => registerType(3, true)).toThrow(/字节形状/);
  });

  it("结构体: 字段相加", () => {
    const Test = struct("Test", {
      a: uint32_t,
      b: uint8_t,
    });
    expect(Test.encode({ a: 1, b: 2 }).byteLength).toBe(5);

    const Test2 = struct("Test", {
      a: bytes(5),
      b: uint8_t,
    });
    expect(Test2.encode({ a: Uint8Array.from([1, 2, 3, 4, 5]), b: 1 }).byteLength).toBe(6);
  });

  it("结构体: 嵌套结构体不加对齐", () => {
    const A = struct("A", {
      a: uint64_t,
      b: uint8_t,
    });
    const B = struct("B", {
      a: uint32_t,
      b: A,
      c: uint8_t,
    });
    // 4 + 9 + 1 = 14 —— 嵌套结构体按自己的实际宽度计入
    const encoded = B.encode({ a: 1, b: { a: 2, b: 3 }, c: 4 });
    expect(encoded.byteLength).toBe(14);
  });

  it("变长字段的尺寸靠 encode 量出来, 不会与实际产出不一致", () => {
    const s = struct("Test", {
      n: uint8_t,
      p: bytes(ref("n")),
    });

    expect(s.encode({ n: 3, p: new Uint8Array(3) }).byteLength).toBe(4);
    expect(s.encode({ n: 10, p: new Uint8Array(10) }).byteLength).toBe(11);
    expect(s.encode({ n: 3, p: new Uint8Array([1, 2, 3]) }).byteLength).toBe(4);
  });
});

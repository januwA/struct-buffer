import {
  DecodeError,
  bytes,
  delimited,
  ref,
  struct,
  uint16_t,
  uint32_t,
  uint8_t,
} from "../src";

/**
 * 宽松解码(`decodeLenient`).
 *
 * 抓包/流式解析里"一帧里有个字段坏了"是常态, 整帧丢掉等于没抓到. 恢复原则只有
 * 一个: **只在位置仍然精确时继续**.
 *
 * - 定长字段失败 ⇒ 位置仍然精确, 跳过它继续解析后面的字段
 * - 变长字段失败 ⇒ 长度字段被带偏, 后面从哪开始已经无从得知, 只能停
 *
 * 注意本文件里 uint16_t 走**大端**(库默认 littleEndian=false), 所以多字节数值
 * 要写成高字节在前.
 */
describe("宽松解码 decodeLenient", () => {
  const Frame = struct("Frame", {
    op: uint8_t,
    len: uint16_t,
    body: bytes(ref("len")),
    tail: uint8_t,
  });

  const wire = (...n: number[]) => Uint8Array.from(n);

  it("好帧: 与严格解码等价, errors 为空", () => {
    const w = wire(0x10, 0x00, 0x03, 1, 2, 3, 0xff);
    const strict = Frame.decode(w);
    const r = Frame.decodeLenient(w);
    expect(r.errors).toEqual([]);
    expect(r.consumed).toBe(w.length);
    expect(r.value).toEqual(strict);
    expect(Array.from(r.value.body)).toEqual([1, 2, 3]);
  });

  it("定长字段失败: 跳过它继续, 后面的字段照样解出来", () => {
    // 尾部被截断: 最后的 tail(定长)读不到
    const w = wire(0x10, 0x00, 0x02, 0xaa, 0xbb);
    const r = Frame.decodeLenient(w);
    expect(r.value.op).toBe(0x10);
    expect(Array.from(r.value.body)).toEqual([0xaa, 0xbb]);
    expect(r.value.tail).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0]).toBeInstanceOf(DecodeError);
    expect(r.errors[0].where).toBe("Frame.tail");
    expect(r.errors[0].offset).toBe(5);
    expect(r.errors[0].need).toBe(1);
    expect(r.errors[0].have).toBe(0);
    // 严格解码对同一帧就是抛
    expect(() => Frame.decode(w)).toThrow(DecodeError);
  });

  it("变长字段失败: 位置不可信, 停在那里", () => {
    // len 说是 0x0200(512), 实际只有 3 字节 ⇒ body 越界
    const w = wire(0x10, 0x02, 0x00, 0xaa, 0xbb, 0xff);
    const r = Frame.decodeLenient(w);
    expect(r.value.op).toBe(0x10);
    expect(r.value.len).toBe(0x200);
    expect(r.value.body).toBeUndefined();
    // tail 在 body 之后, 位置已不可信 ⇒ 不猜
    expect(r.value.tail).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].where).toBe("Frame.body");
    expect(r.errors[0].need).toBe(0x200);
    expect(r.errors[0].have).toBe(3);
    // 半截的推进必须回滚, consumed 停在失败点
    expect(r.consumed).toBe(3);
  });

  it("ref 指向尚未解析的字段: 记录错误, 但 body 变长所以只能停", () => {
    // len 声明在 body 之后: 长度头在数据之后, 解码器本就无从知道 body 有多长
    const Fwd = struct("Fwd", {
      body: bytes(ref("len")),
      len: uint8_t,
    });
    const w = wire(1, 2, 3, 0x07);
    const r = Fwd.decodeLenient(w);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].message).toContain("尚未解析");
    expect(r.value.body).toBeUndefined();
    expect(r.value.len).toBeUndefined();
    expect(() => Fwd.decode(w)).toThrow(DecodeError);
    // encode 方向仍然可用: 长度头可以声明在数据之后
    expect(Fwd.encode({ body: wire(1, 2, 3), len: 3 }).byteLength).toBe(4);
  });

  it("嵌套定长子结构体: 里面的坏字段照样恢复, 定位串一路带进子结构", () => {
    const Inner = struct("Inner", { x: uint16_t, y: uint16_t });
    const Outer = struct("Outer", {
      head: uint8_t,
      inner: Inner,
      tail: uint8_t,
    });
    // head(1B) + inner 声明 4B 只剩 2B
    const r = Outer.decodeLenient(wire(0x07, 0x11, 0x11));
    expect(r.value.head).toBe(0x07);
    // inner.x 完整解出来了, 只有 y 越界 —— 嵌套结构体内部也有恢复能力
    expect((r.value as any).inner.x).toBe(0x1111);
    expect((r.value as any).inner.y).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].where).toBe("Outer.inner.y");
    expect(r.errors[0].have).toBe(0);
  });

  it("嵌套变长字段失败: stopped 逐层向上传播, 外层后续字段不猜", () => {
    const Inner = struct("Inner", {
      n: uint8_t,
      body: bytes(ref("n")),
    });
    const Outer = struct("Outer", {
      head: uint8_t,
      inner: Inner,
      tail: uint32_t,
    });
    // head(1B) + n=0xff + 2B body + 4B tail
    const r = Outer.decodeLenient(wire(0x07, 0xff, 0xaa, 0xbb, 0, 0, 0, 1));
    expect(r.value.head).toBe(0x07);
    expect((r.value as any).inner.n).toBe(0xff);
    expect((r.value as any).inner.body).toBeUndefined();
    expect(r.value.tail).toBeUndefined();
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].where).toBe("Outer.inner.body");
    expect(r.errors[0].offset).toBe(2);
    expect(r.errors[0].need).toBe(0xff);
  });

  it("只捕获 DecodeError, 自定义 codec 的 TypeError 照炸", () => {
    const boom = delimited<number>({
      read: () => {
        throw new TypeError("codec 写错了");
      },
      write: (w) => w.u8(1),
    });
    const Bad = struct("Bad", { a: uint8_t, b: boom });
    expect(() => Bad.decode(wire(1, 2))).toThrow(TypeError);
    // 宽松解码不能把 bug 伪装成"这帧数据坏了"
    expect(() => Bad.decodeLenient(wire(1, 2))).toThrow(TypeError);
  });

  it("失败字段恒为 undefined, 绝不返回半截的值", () => {
    const r = Frame.decodeLenient(wire(0x10, 0x02, 0x00, 0xaa, 0xbb, 0xff));
    expect("body" in (r.value as object)).toBe(true);
    expect((r.value as any).body).toBeUndefined();
  });
});

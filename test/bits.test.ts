import {
  uint32_t,
  bits,
  uint16_t,
  uint8_t,
  uint64_t,
  list,
  struct,
} from "../src";

describe("bits test", () => {
  it("decode and encode", () => {
    // zf,pf,if
    const eflag_data = 0x00000246;
    const littleEndian = true;

    const EFLAG = bits(uint32_t, {
      CF: 0,
      PF: 2,
      AF: 4,
      ZF: 6,
      SF: 7,
      TF: 8,
      IF: 9,
      DF: 10,
      OF: 11,
    });
    const data = EFLAG.decode(new Uint32Array([eflag_data]), littleEndian);
    expect([data.ZF, data.PF, data.IF]).toEqual([1, 1, 1]);

    const view = EFLAG.encode(
      {
        PF: 1,
        ZF: 1,
        IF: 1,
      },
      littleEndian
    );
    expect(view.getUint8(0)).toBe(0x44);
  });

  it("test struct", () => {
    const Test = struct("Test", {
      id: uint16_t,
      eflag: list(
        bits(uint32_t, {
          PF: 2,
          ZF: 6,
          TF: 8,
          IF: 9,
        }),
        2
      ),
    });

    const data = Test.decode([
      0, 1, 0x00, 0x00, 0x02, 0x46, 0x00, 0x00, 0x02, 0x46,
    ]);
    expect(data.eflag.length).toBe(2);
  });

  it("列表里的空洞元素补 0, 不再抛裸 TypeError", () => {
    const EFLAG = bits(uint8_t, { a: 0, b: 1 });
    expect(list(EFLAG, 2).decode([0b10, 0b01])).toEqual([
      { a: 0, b: 1 },
      { a: 1, b: 0 },
    ]);
    // 第二个元素缺位: 旧实现直接 `Object.entries(undefined[i])` ⇒ TypeError
    const view = list(EFLAG, 2).encode([{ a: 1, b: 0 }, undefined] as any);
    expect(Array.from(new Uint8Array(view.buffer))).toEqual([0b01, 0b00]);
  });

  it("位下标越界 / 取值非 0-1 在构造期或 encode 期报错", () => {
    expect(() => bits(uint8_t, { a: 8 })).toThrow(/越界/);
    expect(() => bits(uint8_t, { a: -1 })).toThrow(/越界/);
    expect(() => bits(uint8_t, { a: 0 }).encode({ a: 2 } as any)).toThrow(
      /0 或 1/
    );
  });

  it("只支持 1/2/4 字节存储(位运算是 32 位)", () => {
    expect(() => bits(uint64_t, { a: 0 })).toThrow(/只支持/);
  });
});

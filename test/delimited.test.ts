import {
  DecodeError,
  delimited,
  bytes,
  float,
  framed,
  struct,
  uint8_t,
  uint16_t,
  ref,
} from "../src";

const bytesOf = (dv: DataView) => Array.from(new Uint8Array(dv.buffer));
const hex = (bs: number[]) =>
  bs.map((b) => b.toString(16).padStart(2, "0")).join(" ");

/**
 * NUL 结尾的 C 字符串. 这就是 docstring 里那个例子 —— 文档与测试共用同一份,
 * 免得示例腐烂成谎话.
 */
const cstr = () =>
  delimited<string>({
    read: (c) => {
      const at = c.pos;
      while (c.left > 0) {
        if (c.view.getUint8(c.pos++) === 0) {
          const n = c.pos - at - 1;
          const view = new Uint8Array(
            c.view.buffer,
            c.view.byteOffset + at,
            n
          );
          return new TextDecoder().decode(view);
        }
      }
      throw DecodeError.reason(c.where, at, "没遇到结尾 NUL");
    },
    write: (w, v) => {
      w.bytes(new TextEncoder().encode(v));
      w.u8(0);
    },
  });

/** 与 `cstr` 只差"读几个": framed 是读到字节耗尽, delimited 只读一个 */
const framedCstr = () =>
  framed<string>({
    read: (c) => {
      const at = c.pos;
      while (c.left > 0) {
        if (c.view.getUint8(c.pos++) === 0) {
          const n = c.pos - at - 1;
          const view = new Uint8Array(
            c.view.buffer,
            c.view.byteOffset + at,
            n
          );
          return new TextDecoder().decode(view);
        }
      }
      return null;
    },
    write: (w, v) => {
      w.bytes(new TextEncoder().encode(v));
      w.u8(0);
    },
  });

describe("delimited", () => {
  it("夹在定长字段中间时不会吃掉后面的字节", () => {
    const M = struct("Player", {
      hp: float,
      name: cstr(),
      mp: float,
    });

    const view = M.encode({ hp: 100, name: "Player1", mp: 100 });
    // <42 c8 00 00> 50 6c 61 79 65 72 31 00 <42 c8 00 00>
    expect(bytesOf(view)).toEqual([
      0x42, 0xc8, 0, 0, 0x50, 0x6c, 0x61, 0x79, 0x65, 0x72, 0x31, 0, 0x42,
      0xc8, 0, 0,
    ]);

    expect(M.decode(view)).toEqual({ hp: 100, name: "Player1", mp: 100 });
  });

  it("放在末尾时与 framed 字节一致", () => {
    const one = struct("M", { hp: float, name: cstr() });
    const many = struct("M", {
      hp: float,
      name: framedCstr(),
    });

    const a = one.encode({ hp: 100, name: "Player1" });
    const b = many.encode({ hp: 100, name: ["Player1"] });
    expect(bytesOf(a)).toEqual(bytesOf(b));
  });

  it("同一实例连续 encode 不同长度不会串味", () => {
    const M = struct("M", { n: cstr(), tail: uint8_t });

    for (const s of ["a", "abcdefghij", "xy"]) {
      const view = M.encode({ n: s, tail: 7 });
      expect(M.decode(view)).toEqual({ n: s, tail: 7 });
    }
  });

  it("连续两个自定界字段各读各的", () => {
    const M = struct("M", { a: cstr(), b: cstr() });

    const view = M.encode({ a: "aa", b: "bb" });
    expect(hex(bytesOf(view))).toBe("61 61 00 62 62 00");
    expect(M.decode(view)).toEqual({ a: "aa", b: "bb" });
  });

  it("与定长字段混排时位置不漂移", () => {
    const M = struct("M", {
      a: uint8_t,
      n: cstr(),
      b: uint16_t,
    });

    const view = M.encode({ a: 1, n: "zz", b: 258 });
    expect(hex(bytesOf(view))).toBe("01 7a 7a 00 01 02");
    expect(M.decode(view)).toEqual({ a: 1, n: "zz", b: 258 });
  });

  it("空串合法", () => {
    const M = struct("M", { n: cstr(), tail: uint8_t });

    const view = M.encode({ n: "", tail: 1 });
    expect(hex(bytesOf(view))).toBe("00 01");
    expect(M.decode(view)).toEqual({ n: "", tail: 1 });
  });

  it("reader 返回 null 报'子帧不完整'而不是当成流结束", () => {
    const M = struct("M", {
      n: delimited<string>({ read: () => null, write: (w) => w.u8(1) }),
      tail: uint8_t,
    });

    expect(() => M.decode(Uint8Array.from([1, 2]))).toThrow(/子帧不完整/);
  });

  it("零长度子帧合法 —— 单次读没有循环, 不推进不是死循环", () => {
    // 与 framed 相反: framed 的循环不推进会真的死循环, 所以那边必须报错;
    // delimited 只读一次, 空 C 字符串消费 0 字节是合法的
    const M = struct("M", {
      n: delimited<string>({ read: () => "", write: () => {} }),
      tail: uint8_t,
    });

    expect(M.decode(M.encode({ n: "", tail: 9 }))).toEqual({ n: "", tail: 9 });
  });

  it("framed 的 reader 不推进则报死循环", () => {
    const M = struct("M", {
      ops: framed<number>({ read: () => 1, write: (w) => w.u8(1) }),
    });

    expect(() => M.decode(Uint8Array.from([1, 2]))).toThrow(/没有消费任何字节/);
  });

  it("decodeLenient 收集 DecodeError 而不是整帧丢掉", () => {
    const M = struct("M", { n: cstr(), tail: uint8_t });

    // n 没遇到结尾 NUL
    const { value, errors, consumed } = M.decodeLenient(Uint8Array.from([1, 2]));
    // 变长字段失败 ⇒ 就地停止, 不猜后面是什么; 位置也回滚到子帧起点
    expect(value).toEqual({});
    expect(errors.map((e) => e.message)).toEqual([
      expect.stringMatching(/没遇到结尾 NUL/),
    ]);
    expect(consumed).toBe(0);
  });

  it("reader 抛的非 DecodeError 异常照炸, 不被 lenient 吞掉", () => {
    const M = struct("M", {
      n: delimited<string>({
        read: () => {
          throw new TypeError("我就是个普通异常");
        },
        write: (w) => w.u8(1),
      }),
    });

    expect(() => M.decodeLenient(Uint8Array.from([1]))).toThrow(TypeError);
  });

  it("坏帧的偏移量指向子帧起点", () => {
    const M = struct("M", { lead: uint16_t, n: cstr() });

    try {
      M.decode(Uint8Array.from([1, 0, 0x61]));
      throw new Error("本该抛");
    } catch (e) {
      expect(e).toBeInstanceOf(DecodeError);
      // 子帧从 @2 开始
      expect((e as DecodeError).offset).toBe(2);
    }
  });
});

describe("delimited 与 framed 的区别", () => {
  it("framed 失败时已经把后面字段的字节吃掉了, 所以后面字段读不到", () => {
    const good = struct("M", { n: cstr(), tail: uint8_t });
    const greedy = struct("M", {
      n: framedCstr(),
      tail: uint8_t,
    });

    // 两者写出的字节完全一样
    const wire = Array.from(
      new Uint8Array(greedy.encode({ n: ["hi"], tail: 9 }).buffer)
    );
    expect(wire).toEqual([0x68, 0x69, 0x00, 0x09]);

    // delimited 读得回来
    expect(good.decode(Uint8Array.from(wire))).toEqual({ n: "hi", tail: 9 });

    // framed 读完 "hi" 之后还想再读一个子帧, 于是把 tail 那个字节也吞了,
    // 结果 tail 读到末尾 —— 不是"多读一点", 是后面字段直接坏掉
    expect(() => greedy.decode(Uint8Array.from(wire))).toThrow(
      /M\.tail @4 需要 1B, 只剩 0B/
    );
  });

  it("framed 只能放在最后 —— 它读到缓冲区末尾", () => {
    const M = struct("M", { ops: framedCstr() });
    const view = M.encode({ ops: ["a", "bb", "ccc"] });
    expect(hex(bytesOf(view))).toBe("61 00 62 62 00 63 63 63 00");
    expect(M.decode(view)).toEqual({ ops: ["a", "bb", "ccc"] });

    // 后面还有定长字段时它会把那个字段的字节也吃掉
    const bad = struct("M", {
      ops: framedCstr(),
      tail: uint8_t,
    });
    expect(() => bad.decode(bad.encode({ ops: ["a"], tail: 7 }))).toThrow(
      /M\.tail @3 需要 1B, 只剩 0B/
    );
  });
});

describe("声明式长度回填(取代自定义 Field 的 resolveLengths)", () => {
  it("缺失的长度字段按值的实际字节数回填", () => {
    const M = struct("M", { len: uint8_t, p: bytes(ref("len")) });
    const view = M.encode({ p: new Uint8Array([1, 2, 3]) } as any);
    expect(hex(bytesOf(view))).toBe("03 01 02 03");
    expect(M.decode(view)).toEqual({
      len: 3,
      p: new Uint8Array([1, 2, 3]),
    });
  });
});

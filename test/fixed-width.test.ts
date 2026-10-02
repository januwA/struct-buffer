import {
  Cursor,
  DecodeError,
  DynamicStructBuffer,
  InferType,
  blob,
  field,
  float,
  framed,
  ref,
  rest,
  skip,
  uint8_t,
  uint16_t,
  uint32_t,
  variant,
} from "../src";
import type { Field } from "../src/field";

const bytes = (dv: DataView) => Array.from(new Uint8Array(dv.buffer));

/**
 * 定宽字节字段的宽度语义, 以及被**扔掉**的那条约定。
 *
 * 保留的一条: encode 必须写满 n 字节(短补 0 / 长截断)。只写实际长度会让后面所有字段
 * 整体前移, 而 `sizeof()` 报的仍是 n —— 错位要到对端才暴露。
 *
 * 扔掉的一条: decode 曾按"第一个 NUL 处截断"处理定宽字段。那是协议约定而不是字节属性
 * —— 定宽字段也常见空格补位或满宽正文, 猜错就是静默丢数据。截断现在归调用点。
 */
describe("定宽字节字段", () => {
  it("encode 写满宽度: 短补 NUL, 长截断", () => {
    const P = new DynamicStructBuffer("p", {
      head: uint8_t,
      name: blob(8),
      tail: uint8_t,
    });
    expect(bytes(P.encode({ head: 1, name: [0x61, 0x62], tail: 9 }))).toEqual([
      1, 0x61, 0x62, 0, 0, 0, 0, 0, 0, 9,
    ]);
    expect(
      bytes(P.encode({ head: 1, name: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], tail: 9 }))
    ).toEqual([1, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    // 缺省值补满: 长度字段不存在时同样不能少写
    expect(bytes(P.encode({ head: 1 }))).toEqual([1, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  });

  it("decode 原样给满宽度, 不替调用方截 NUL", () => {
    const P = new DynamicStructBuffer("p", {
      head: uint8_t,
      name: blob(8),
      tail: uint8_t,
    });
    const d = P.decode(Uint8Array.from([1, 0x61, 0x00, 0, 0, 0, 0, 0, 0, 9]));
    expect([d.head, Array.from(d.name), d.tail]).toEqual([
      1,
      [0x61, 0, 0, 0, 0, 0, 0, 0],
      9,
    ]);

    // NUL 补位是 C 风格字符串的约定, 要用的人自己切 —— 多字节序列不会被劈开,
    // 因为 NUL 是单字节且不可能出现在 UTF-8 / GBK 序列中间
    const cut = (b: Uint8Array) => {
      const nul = b.indexOf(0);
      return new TextDecoder().decode(nul < 0 ? b : b.subarray(0, nul));
    };
    const d2 = P.decode(
      Uint8Array.from([1, 0xe4, 0xb8, 0x96, 0, 0, 0, 0, 0, 9])
    );
    expect(cut(d2.name)).toBe("世");
    expect(d2.tail).toBe(9);
  });

  it("定宽 blob 同样写满宽度", () => {
    const P = new DynamicStructBuffer("p", {
      head: uint8_t,
      pad: blob(4),
      tail: uint8_t,
    });
    expect(bytes(P.encode({ head: 1, pad: [0xaa], tail: 9 }))).toEqual([
      1, 0xaa, 0, 0, 0, 9,
    ]);
    expect(bytes(P.encode({ head: 1, pad: [1, 2, 3, 4, 5], tail: 9 }))).toEqual([
      1, 1, 2, 3, 4, 9,
    ]);
    expect(Array.from(P.decode(Uint8Array.from([1, 0xaa, 0, 0, 0, 9])).pad)).toEqual([
      0xaa, 0, 0, 0,
    ]);
  });
});

/** README 里的示例必须真的跑得起来 —— 文档跟实现各说各话是最贵的坑 */
describe("README 示例", () => {
  it("变长字段: encode 回填长度且不改入参", () => {
    const Msg = new DynamicStructBuffer(
      "msg",
      {
        type: uint8_t,
        len: uint16_t,
        payload: uint8_t[ref("len")],
        name: blob(8),
      },
      { littleEndian: true }
    );
    const obj = { type: 1, payload: [0x41, 0x42], name: [0x61, 0x62, 0x63] };
    const dv = Msg.encode(obj);
    expect(bytes(dv)).toEqual([
      1, 2, 0, 0x41, 0x42, 0x61, 0x62, 0x63, 0, 0, 0, 0, 0,
    ]);
    expect(obj).toEqual({ type: 1, payload: [0x41, 0x42], name: [0x61, 0x62, 0x63] });

    const d = Msg.decode(new Uint8Array(dv.buffer));
    expect([d.type, d.len, Array.from(d.payload), Array.from(d.name)]).toEqual([
      1,
      2,
      [0x41, 0x42],
      [0x61, 0x62, 0x63, 0, 0, 0, 0, 0],
    ]);
  });

  it("嵌套列表: ref 决定个数, 固定 2x2", () => {
    const Item = new DynamicStructBuffer("item", { id: uint32_t });
    const Grid = new DynamicStructBuffer("grid", {
      n: uint8_t,
      rows: Item[ref("n")],
      pairs: Item[2][2],
    });
    type _t = [
      Assert<
        Equals<
          InferType<typeof Grid>,
          { n: number; rows: { id: number }[]; pairs: { id: number }[][] }
        >
      >
    ];
    const u32 = (n: number) => [n >>> 24, (n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
    const d = Grid.decode(
      Uint8Array.from([2, ...u32(1), ...u32(2), ...u32(3), ...u32(4), ...u32(5), ...u32(6), ...u32(7)])
    );
    expect(d.n).toBe(2);
    expect(d.rows.map((r) => r.id)).toEqual([1, 2]);
    expect(d.pairs.map((r) => r.map((x) => x.id))).toEqual([
      [3, 4],
      [5, 6],
    ]);
    expect(d.pairs[1][1].id).toBe(6);
  });

  it("skip(n): 占住位置但结果里没有这个字段", () => {
    // 典型的二进制协议布局: 定长记录里夹着未知/保留字节
    const EntMove = new DynamicStructBuffer(
      "ent",
      {
        _unk0: skip(1),
        sel: uint16_t,
        _unk1: skip(3),
        tag: uint8_t,
        cnt: uint8_t,
        _unk2: skip(4),
        x: float,
        y: float,
      },
      { littleEndian: true }
    );
    // 类型里已经没有 _unk*, 消费方可以直接构造上报结构
    type Ent = InferType<typeof EntMove>;
    type _t = [
      Assert<
        Equals<Ent, { sel: number; tag: number; cnt: number; x: number; y: number }>
      >
    ];

    const body = new Uint8Array(20);
    const dv = new DataView(body.buffer);
    body[0] = 0xaa;
    dv.setUint16(1, 0x069c, true);
    dv.setUint16(5, 0x1234, true);
    body[6] = 0xf8;
    body[7] = 0x31;
    dv.setUint32(8, 0xdeadbeef, true);
    dv.setFloat32(12, 12.345, true);
    dv.setFloat32(16, -7.65, true);

    // 结果里只有真实字段
    expect(EntMove.decode(body)).toEqual({
      sel: 0x069c,
      tag: 0xf8,
      cnt: 0x31,
      x: 12.345000267028809,
      y: -7.650000095367432,
    });
    // encode 时填充位写 0, 长度不变
    const enc = bytes(
      EntMove.encode({ sel: 1, tag: 2, cnt: 3, x: 1, y: 2 })
    );
    expect(enc.length).toBe(20);
    expect(enc).toEqual([
      0, 1, 0, 0, 0, 0, 2, 3, 0, 0, 0, 0, 0, 0, 0x80, 0x3f, 0, 0, 0, 0x40,
    ]);
    // skip 也占 sizeof
    expect(EntMove.struct).toBeDefined();
  });

  it("blob / rest / variant", () => {
    const Pkt = new DynamicStructBuffer(
      "pkt",
      {
        len: uint16_t,
        payload: blob(ref("len")),
        tail: rest(),
      },
      { littleEndian: true }
    );
    const d = Pkt.decode(Uint8Array.from([2, 0, 0x41, 0x42, 0x63]));
    expect([d.len, Array.from(d.payload), Array.from(d.tail)]).toEqual([
      2,
      [0x41, 0x42],
      [0x63],
    ]);

    const V = new DynamicStructBuffer("v", {
      msg_type: uint8_t,
      body: variant("msg_type", {
        1: { name: blob(3) },
        2: { x: uint32_t, y: uint32_t },
      }),
    });
    expect(V.decode(Uint8Array.from([1, 0x61, 0x62, 0x63]))).toEqual({
      msg_type: 1,
      name: Uint8Array.from([0x61, 0x62, 0x63]),
    });
    expect(bytes(V.encode({ msg_type: 2, x: 1, y: 2 }))).toEqual([
      2, 0, 0, 0, 1, 0, 0, 0, 2,
    ]);

    const F = new DynamicStructBuffer("f", {
      ops: framed<{ op: number; body: Uint8Array }>(
        {
          read: (c) => {
            if (c.left < 2) return null; // 不够一个头 ⇒ 流结束
            const op = c.u8("op");
            const n = c.u8("flen");
            return { op, body: c.bytes(n, "body") };
          },
        },
        {
          write: (w, v) => {
            w.u8(v.op);
            w.u8(v.body.length);
            w.bytes(v.body);
          },
        }
      ),
    });
    const fd = F.decode(Uint8Array.from([1, 2, 0x61, 0x62, 3, 1, 0x63]));
    expect(fd.ops.map((o) => [o.op, Array.from(o.body)])).toEqual([
      [1, [0x61, 0x62]],
      [3, [0x63]],
    ]);
    expect(
      bytes(F.encode({ ops: [{ op: 9, body: Uint8Array.from([7]) }] }))
    ).toEqual([9, 1, 7]);
  });

  it("宽松解码: 变长字段失败即停, 位置已不可信", () => {
    const Msg = new DynamicStructBuffer(
      "msg",
      {
        type: uint8_t,
        len: uint16_t,
        payload: uint8_t[ref("len")],
        name: blob(8),
      },
      { littleEndian: true }
    );
const view = Uint8Array.from([1, 0xff, 0xff]);
    const { value, errors, consumed } = Msg.decodeLenient(view);
    expect(value).toEqual({ type: 1, len: 65535, payload: undefined });
    expect(errors).toHaveLength(1);
    expect(errors[0].where).toBe("msg.payload");
    expect(errors[0].message).toBe("DecodeError: msg.payload @3 需要 65535B, 只剩 0B");
    // 失败字段的半截推进先回滚, 于是 consumed 正好停在"从哪开始不可信"的位置
    expect(consumed).toBe(3);

    // 失败字段的半截推进先回滚; 字节根本不够时直接停 —— 位置已经不可信
const Short = new DynamicStructBuffer("short", { a: uint32_t, b: uint8_t });
const r = Short.decodeLenient(Uint8Array.from([1, 2]));
expect(r.errors.map((e) => e.where)).toEqual(["short.a"]);
expect(r.value.a).toBeUndefined();
expect(r.consumed).toBe(0);

    // 类型层面 LenientResult 的 value 就是 D
    type _t = [Assert<Equals<typeof value, InferType<typeof Msg>>>];
  });

  /**
   * "跳过继续"只在**字节还够**的时候成立: 失败的是定长字段且剩余字节够它的宽度,
   * 说明位置仍然可信. 现实中主要就是自定义 codec 的值校验(比如判别字段没有对应
   * 分支); 内置字段的越界本来就意味着后面全不可信.
   */
  it("定长字段因 codec 抛错时跳过继续", () => {
    const checked = field<number>((b) => {
      // 自定义 codec 自己拼字段路径: c.where 只有结构名, 定位不到具体字段
      const where = `${b.parentName}.${b.name}`;
      return {
        name: b.name,
        fixedSize: 1,
        decode(c: Cursor, out: Record<string, unknown>) {
          const v = c.u8(b.name);
          if (v > 200) throw DecodeError.reason(where, c.pos, `值 ${v} 超过 200`);
          out[b.name] = v;
        },
        encode(w, v) {
          w.u8(v as number);
        },
        resolveLengths: (o: Record<string, unknown>) => o,
      };
    });
    const P = new DynamicStructBuffer("p", {
      a: checked,
      b: uint8_t,
      c: uint8_t,
    });
    const r = P.decodeLenient(Uint8Array.from([250, 7, 9]));
    expect([r.value.a, r.value.b, r.value.c]).toEqual([undefined, 7, 9]);
    expect(r.errors.map((e) => e.where)).toEqual(["p.a"]);
    expect(r.consumed).toBe(3);
    expect(() => P.decode(Uint8Array.from([250, 7, 9]))).toThrow(DecodeError);
  });
});

type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <
  T
>() => T extends B ? 1 : 2
  ? true
  : false;
type Assert<T extends true> = T;
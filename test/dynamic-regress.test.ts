import {
  bitFields,
  blob,
  Cursor,
  DecodeError,
  discriminated,
  DynamicStructBuffer,
  framed,
  records,
  ref,
  rest,
  string_t,
  StructBuffer,
  uint16_t,
  uint32_t,
  uint8_t,
  variant,
} from "../src";
import { Writer } from "../src/writer";

const hex = (dv: DataView) =>
  Array.from({ length: dv.byteLength }, (_, i) =>
    dv.getUint8(i).toString(16).padStart(2, "0")
  ).join(" ");

describe("DynamicStructBuffer 回归(实测 8 个 bug)", () => {
  it("嵌套 DynamicStructBuffer 列表 encode/decode 往返", () => {
    const Item = new DynamicStructBuffer("item", { id: uint32_t, n: uint8_t });
    const Bag = new DynamicStructBuffer("bag", {
      item_count: uint8_t,
      items: Item[ref("item_count")],
    });

    const encoded = Bag.encode({
      item_count: 2,
      items: [
        { id: 0x11223344, n: 7 },
        { id: 0x55667788, n: 9 },
      ],
    });

    // 1 + 2 * 5 = 11 字节. 旧实现长度也是 11, 但内容全 0, 且 decode 直接抛
    // RangeError —— 根因是外层循环 + 内部整段 decode 造成的 N² 与偏移漂移
    expect(encoded.byteLength).toBe(11);
    expect(hex(encoded)).toBe("02 11 22 33 44 07 55 66 77 88 09");
    expect(Bag.decode(encoded)).toEqual({
      item_count: 2,
      items: [
        { id: 0x11223344, n: 7 },
        { id: 0x55667788, n: 9 },
      ],
    });
  });

  it("嵌套结构体多维 deeps 往返", () => {
    const Item = new DynamicStructBuffer("item", { id: uint8_t });
    const Deep = new DynamicStructBuffer("deep", {
      tag: uint8_t,
      items: Item[2][2],
    });

    const encoded = Deep.encode({
      tag: 3,
      items: [
        [
          { id: 1 },
          { id: 2 },
        ],
        [
          { id: 3 },
          { id: 4 },
        ],
      ],
    });
    expect(encoded.byteLength).toBe(1 + 4);
    expect(hex(encoded)).toBe("03 01 02 03 04");
    expect(Deep.decode(encoded)).toEqual({
      tag: 3,
      items: [
        [
          { id: 1 },
          { id: 2 },
        ],
        [
          { id: 3 },
          { id: 4 },
        ],
      ],
    });
  });

  it("前向 ref 的 encode 仍然可用(长度头可以声明在数据之后)", () => {
    const Fwd = new DynamicStructBuffer("fwd", {
      data: uint8_t[ref("len")],
      len: uint8_t,
    });
    const encoded = Fwd.encode({ data: [0xde, 0xad, 0xbe] } as any);
    expect(hex(encoded)).toBe("de ad be 03");
  });

  it("前向 ref 的 decode 明确报错, 不再静默产出垃圾", () => {
    const Fwd = new DynamicStructBuffer("fwd", {
      data: uint8_t[ref("len")],
      len: uint8_t,
    });
    // 旧实现 decode 出 {data: [], len: 1} —— 看起来成功, 实际完全错
    expect(() => Fwd.decode([0, 1])).toThrow(DecodeError);
    expect(() => Fwd.decode([0, 1])).toThrow(/尚未解析/);
  });

  it("ref 驱动的列表不再静默返回空数组", () => {
    const Padded = new DynamicStructBuffer("padded", {
      n: uint8_t,
      pad: uint8_t[ref("n")],
    });
    const encoded = Padded.encode({ n: 3 });
    expect(encoded.byteLength).toBe(4);
    expect(Padded.decode(encoded)).toEqual({ n: 3, pad: [0, 0, 0] });
  });

  it("encode 不修改调用方对象", () => {
    const Msg = new DynamicStructBuffer("msg", {
      msg_size: uint16_t,
      msg: uint8_t[ref("msg_size")],
    });
    const input = { msg: [1, 2, 3] } as any;
    const snapshot = JSON.stringify(input);
    Msg.encode(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect("msg_size" in input).toBe(false);
  });

  it("中文文本按字节长度而非字符长度", () => {
    const Chat = new DynamicStructBuffer("chat", {
      text_len: uint16_t,
      text: string_t[ref("text_len")],
    });
    const encoded = Chat.encode({ text: "世界" } as any);
    // "世界" 的 s.length 是 2, UTF-8 是 6 字节. 旧实现写成 len=2 + 2 字节正文
    expect(encoded.byteLength).toBe(2 + 6);
    expect(hex(encoded)).toBe("00 06 e4 b8 96 e7 95 8c");
    expect(Chat.decode(encoded)).toEqual({ text_len: 6, text: "世界" });
  });

  it("畸形长度抛出带结构名/字段名/偏移的 DecodeError", () => {
    const Msg = new DynamicStructBuffer("msg", {
      msg_size: uint16_t,
      msg: uint8_t[ref("msg_size")],
    });
    let err: any;
    try {
      Msg.decode([0x00, 0x10, 0x01]);
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(DecodeError);
    expect(err.where).toBe("msg.msg");
    expect(err.offset).toBe(2);
    expect(err.need).toBe(16);
    expect(err.have).toBe(1);
    expect(err.message).toMatch(/msg\.msg/);
  });

  it("bitFields 列表的每个元素是独立对象", () => {
    const Rec = new DynamicStructBuffer("rec", {
      count: uint8_t,
      // bitFields 的值是"该字段占几位"(连续位域), 不是位号; 这里三个都占 1 位
      flags: bitFields(uint8_t, { a: 1, b: 1, c: 1 })[ref("count")],
    });
    const rec = Rec.encode({
      count: 2,
      flags: [
        { a: 1, c: 1 },
        { b: 1 },
      ],
    } as any);
    const out = Rec.decode(rec);
    expect(out.flags).toEqual([
      { a: 1, b: 0, c: 1 },
      { a: 0, b: 1, c: 0 },
    ]);
    // 别名 bug 时这两项是同一个对象, 改一项会改掉另一项
    expect(out.flags[0]).not.toBe(out.flags[1]);
  });

  it("嵌套 StructBuffer 的 littleEndian 由子结构体自己决定", () => {
    const Child = new StructBuffer(
      "child",
      { a: uint16_t, b: uint16_t },
      { littleEndian: true }
    );
    const Parent = new DynamicStructBuffer("parent", {
      c: uint16_t,
      child: Child,
    });
    const encoded = Parent.encode({
      c: 0x0102,
      child: { a: 0x0304, b: 0x0506 },
    });
    // c 走父级(大端), child 走自身配置(小端). 旧实现对嵌套 StructBuffer
    // 一律透传父级 littleEndian, 这里会写成 03 04 05 06
    expect(hex(encoded)).toBe("01 02 04 03 06 05");
    expect(Parent.decode(encoded)).toEqual({
      c: 0x0102,
      child: { a: 0x0304, b: 0x0506 },
    });
  });

  it("父级 littleEndian 会向下继承", () => {
    const Child = new StructBuffer("child", { a: uint16_t });
    const Parent = new DynamicStructBuffer(
      "parent",
      { c: uint16_t, child: Child },
      { littleEndian: true }
    );
    expect(hex(Parent.encode({ c: 0x0102, child: { a: 0x0304 } }))).toBe(
      "02 01 04 03"
    );
  });

  it("encode 写进调用方给的定长 buffer", () => {
    const Msg = new DynamicStructBuffer("msg", {
      msg_size: uint16_t,
      msg: uint8_t[ref("msg_size")],
    });
    const view = new DataView(new ArrayBuffer(16));
    const ret = Msg.encode({ msg: [1, 2, 3] } as any, false, 4, view);
    expect(ret).toBe(view);
    expect(hex(view)).toBe(
      "00 00 00 00 00 03 01 02 03 00 00 00 00 00 00 00"
    );
  });
});

describe("声明式字段: rest / blob / records / variant / framed", () => {
  it("rest 吃掉剩余全部字节", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      op: uint8_t,
      body: rest(),
    });
    const encoded = Pkt.encode({ op: 9, body: [1, 2, 3, 4] });
    expect(hex(encoded)).toBe("09 01 02 03 04");
    expect(Pkt.decode(encoded)).toEqual({ op: 9, body: new Uint8Array([1, 2, 3, 4]) });
  });

  it("rest 与前面的长度前缀字段共存", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      text_len: uint16_t,
      text: string_t[ref("text_len")],
      tail: rest(),
    });
    const encoded = Pkt.encode({ text: "hi", tail: [0xaa, 0xbb] } as any);
    expect(hex(encoded)).toBe("00 02 68 69 aa bb");
    expect(Pkt.decode(encoded)).toEqual({
      text_len: 2,
      text: "hi",
      tail: new Uint8Array([0xaa, 0xbb]),
    });
  });

  it("blob 出 Uint8Array 而不是 number[]", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      len: uint8_t,
      raw: blob(ref("len")),
    });
    const out = Pkt.decode([3, 1, 2, 3]);
    expect(out.raw).toBeInstanceOf(Uint8Array);
    expect(Array.from(out.raw)).toEqual([1, 2, 3]);
  });

  it("records 把定长子记录填到末尾", () => {
    const Ent = new StructBuffer("ent", { id: uint16_t, hp: uint16_t });
    const Pkt = new DynamicStructBuffer("pkt", { ents: records(Ent) });
    const encoded = Pkt.encode({
      ents: [
        { id: 1, hp: 10 },
        { id: 2, hp: 20 },
        { id: 3, hp: 30 },
      ],
    });
    expect(hex(encoded)).toBe("00 01 00 0a 00 02 00 14 00 03 00 1e");
    expect(Pkt.decode(encoded)).toEqual({
      ents: [
        { id: 1, hp: 10 },
        { id: 2, hp: 20 },
        { id: 3, hp: 30 },
      ],
    });
  });

  it("records 遇到变长子结构体直接报错而不是猜尺寸", () => {
    const Bad = new StructBuffer("bad", {
      len: uint8_t,
      data: uint8_t[ref("len")],
    });
    expect(() => new DynamicStructBuffer("p", { x: records(Bad) })).toThrow(
      /变长字段/
    );
  });

  it("variant 按判别字段平铺展开分支", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      msg_type: uint8_t,
      body: variant("msg_type", {
        1: { name: string_t[3] },
        2: { x: uint32_t, y: uint32_t },
      }),
    });

    expect(hex(Pkt.encode({ msg_type: 1, name: "abc" }))).toBe("01 61 62 63");
    expect(Pkt.decode([1, 0x61, 0x62, 0x63])).toEqual({
      msg_type: 1,
      name: "abc",
    });
    expect(Pkt.decode([2, 0, 0, 0, 1, 0, 0, 0, 2])).toEqual({
      msg_type: 2,
      x: 1,
      y: 2,
    });
  });

  it("variant 未知判别值报错时列出已有分支", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      msg_type: uint8_t,
      body: variant("msg_type", { 1: { a: uint8_t } }),
    });
    expect(() => Pkt.decode([7, 0])).toThrow(/msg_type=7/);
    expect(() => Pkt.decode([7, 0])).toThrow(/已有: 1/);
  });

  it("discriminated 把判别字段排在 variant 之前", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      chan: uint8_t,
      ...discriminated("body", "msg_type", uint8_t, {
        0x0a: { len: uint16_t, text: string_t[ref("len")] },
        0x0b: { id: uint32_t },
      }),
    });
    const encoded = Pkt.encode({ chan: 1, msg_type: 0x0a, text: "世界" } as any);
    expect(hex(encoded)).toBe("01 0a 00 06 e4 b8 96 e7 95 8c");
    expect(Pkt.decode(encoded)).toEqual({
      chan: 1,
      msg_type: 0x0a,
      len: 6,
      text: "世界",
    });
  });

  it("framed 逐个读自定界子帧直到字节耗尽", () => {
    const Stream = new DynamicStructBuffer("stream", {
      ops: framed(
        {
          read: (c) => {
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

    const wire = [0x01, 0x02, 0xaa, 0xbb, 0x02, 0x01, 0xcc];
    expect(Stream.decode(wire)).toEqual({
      ops: [
        { op: 1, body: new Uint8Array([0xaa, 0xbb]) },
        { op: 2, body: new Uint8Array([0xcc]) },
      ],
    });
    expect(
      Array.from(
        new Uint8Array(
          Stream.encode({
            ops: [
              { op: 1, body: new Uint8Array([0xaa, 0xbb]) },
              { op: 2, body: new Uint8Array([0xcc]) },
            ],
          }).buffer
        )
      )
    ).toEqual(wire);
  });

  it("framed 子帧用 region 划窗, 帧尾残余不漏进父结构", () => {
    const Stream = new DynamicStructBuffer("stream", {
      tail: uint8_t,
      ops: framed(
        {
          read: (c) => {
            const n = c.u8("n");
            return c.region(n, "frame", (f) => f.rest(""));
          },
        },
        {
          write: (w, v) => {
            w.u8(v.length);
            w.bytes(v);
          },
        }
      ),
    });
    // 第一个子帧声明 4 字节但只给 2 字节有效数据 + 2 字节填充
    const out = Stream.decode([0xff, 0x04, 0x11, 0x22, 0x00, 0x00, 0x01, 0x33]);
    expect(out.tail).toBe(0xff);
    expect(out.ops).toEqual([
      new Uint8Array([0x11, 0x22, 0x00, 0x00]),
      new Uint8Array([0x33]),
    ]);
  });
});

describe("Cursor / Writer", () => {
  it("Cursor 越界抛 DecodeError 而不是裸 RangeError", () => {
    const c = new Cursor([1, 2, 3], 2, undefined, "pkg");
    expect(() => c.u32("id")).toThrow(DecodeError);
    expect(() => c.u32("id")).toThrow(/pkg\.id/);
  });

  it("Cursor.region 结束后父 cursor 整块跳过", () => {
    const c = new Cursor([1, 2, 3, 4, 9, 9], 0, undefined, "pkg");
    const inner = c.region(4, "frame", (r) => r.u16("a") + r.u16("b"));
    expect(inner).toBe(258 + 772); // 大端
    expect(c.pos).toBe(4);
    expect(c.u8("tail")).toBe(9);
  });

  it("Cursor.peek 不消费父 cursor", () => {
    const c = new Cursor([1, 2, 3, 4], 0, undefined, "pkg");
    const r = c.peek(2, "head", (h) => h.u8("a"));
    expect(r).toEqual({ value: 1, size: 1 });
    expect(c.pos).toBe(0);
  });

  it("Writer 可增长, 且 finish 切出恰好写入的字节", () => {
    const w = new Writer({ littleEndian: false });
    w.u8(1);
    w.u32(0x01020304);
    expect(w.finish().byteLength).toBe(5);
  });

  it("Writer 定长模式越界抛 EncodeError", () => {
    const w = new Writer({
      view: new DataView(new ArrayBuffer(2)),
      littleEndian: false,
    });
    w.u8(1);
    expect(() => w.u32(2)).toThrow(/写入越界/);
  });
});

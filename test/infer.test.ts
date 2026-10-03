import {
  DynamicStructBuffer,
  InferDef,
  InferEncodeDef,
  InferType,
  Writer,
  bitFields,
  bits,
  double,
  float,
  framed,
  records,
  ref,
  rest,
  uint16_t,
  uint32_t,
  uint8_t,
  variant,
} from "../src";

const hex = (dv: DataView) =>
  Array.from({ length: dv.byteLength }, (_, i) =>
    dv.getUint8(i).toString(16).padStart(2, "0")
  ).join(" ");

/**
 * 类型推导的断言.
 *
 * 每个用例都是**两重**断言:
 *
 * - 编译期: `Assert<Equals<...>>` / `@ts-expect-error`. 推导错了 tsc 就编译不过 ——
 *   这类问题只有编译期断言才抓得到(旧版 `ref()` 声明成 `any`, 推导到
 *   `uint8_t[ref("len")]` 就断了, 运行时全对而类型上一个字都查不出来)。
 * - 运行时: 真的解一帧字节, 确认推出来的类型和实际值对得上。
 */
type Equals<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B
  ? 1
  : 2
  ? true
  : false;
type Assert<T extends true> = T;

describe("类型推导", () => {
  it("标量", () => {
    const F = new DynamicStructBuffer("F", {
      u8: uint8_t,
      u32: uint32_t,
      f: float,
      d: double,
    });
    type D = InferType<typeof F>;
    type _t = [
      Assert<Equals<D["u8"], number>>,
      Assert<Equals<D["u32"], number>>,
      Assert<Equals<D["f"], number>>,
      Assert<Equals<D["d"], number>>
    ];

    // 1B + 4B + 4B + 8B. double 的字节序交给 double.encode 自己生成 —— 这个用例
    // 考的是推导, 不该在这里手算 IEEE754
    const d = F.decode(
      Uint8Array.from([
        7,
        0,
        0,
        0,
        0,
        0x40,
        0x40,
        0,
        0,
        ...Array.from(new Uint8Array(double.encode(3).buffer)),
      ])
    );
    expect([d.u8, d.u32, d.f, d.d]).toEqual([7, 0, 3, 3]);
  });

  it("布尔语义的字段推出来是 number, 不是 boolean", () => {
    // 库里没有 bool / BOOL / BoolType: 宽度是 uintN_t 的事, 真值判断是调用方的事。
    // 编译期这一半的断言在 bool.test.ts 的运行时那一半之外单列, 因为"折成 boolean"
    // 是个只在类型上才看得出来的诱惑
    const F = new DynamicStructBuffer("F", {
      ok1: uint8_t,
      ok4: uint32_t,
    });
    type D = InferType<typeof F>;
    type _t = [
      Assert<Equals<D["ok1"], number>>,
      Assert<Equals<D["ok4"], number>>
    ];

    const d = F.decode(Uint8Array.from([1, 0, 0, 0, 2]));
    // 真值判断交给调用方, 所以要自己收窄
    expect(d.ok1 !== 0).toBe(true);
    expect(Boolean(d.ok4)).toBe(true);

    // @ts-expect-error 推出来是 number, 与 true 比较不合法
    void (d.ok1 === true);
  });

  it("单维 uint8 下标就是字节, 多维保持嵌套", () => {
    const F = new DynamicStructBuffer("F", {
      a: uint8_t[3],
      b: uint8_t[2][2],
      c: uint16_t[2],
    });
    type D = InferType<typeof F>;
    type _t = [
      // 连续的 uint8 就是一段字节, 不是数字元组
      Assert<Equals<D["a"], Uint8Array>>,
      // 元素比 1 字节宽就不是字节
      Assert<Equals<D["c"], number[]>>
      // b 是嵌套形状: 运行时给 number[][], 但**声明类型**只能给 Uint8Array[] ——
      // 类型层看不到 deeps 的形状(只知道"下标一次"), 分不出 uint8_t[2] 和 uint8_t[2][2]。
      // 这是已知的精度缺口, 运行时行为才是准的
    ];

    const d = F.decode(
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 0x61, 0x62, 0x63, 0x64])
    );
    expect(d.a).toEqual(Uint8Array.from([1, 2, 3]));
    expect(d.b).toEqual([
      [4, 5],
      [6, 7],
    ]);
    expect(d.c).toEqual([0x6162, 0x6364]);
  });

  it("ref 能穿过长度前缀(旧版 ref 是 any, 推导到这里就断了)", () => {
    const F = new DynamicStructBuffer("F", {
      n: uint8_t,
      body: uint8_t[ref("n")],
    });
    type D = InferType<typeof F>;
    type _t = [Assert<Equals<D["n"], number>>, Assert<Equals<D["body"], Uint8Array>>];

    const d = F.decode(Uint8Array.from([2, 0xaa, 0xbb]));
    expect(d.body).toEqual(Uint8Array.from([0xaa, 0xbb]));
  });

  it("bits 是位序号, bitFields 是位宽", () => {
    const F = new DynamicStructBuffer("F", {
      flags: bits(uint8_t, { a: 0, b: 2 }),
      perms: bitFields(uint8_t, { x: 1, y: 1, z: 1 }),
    });
    type D = InferType<typeof F>;
    // bits() 的位名只存在于运行时对象里, 静态上只能给到索引签名类型.
    // 两者不同: bits 每一位只有 0/1, bitFields 的位宽可以 > 1, 值是 number
    type _t = [
      Assert<Equals<D["flags"], { [x: string]: 0 | 1 }>>,
      Assert<Equals<D["perms"], { [x: string]: number }>>
    ];

    const d = F.decode(Uint8Array.from([0b101, 0b011]));
    expect(d.flags).toEqual({ a: 1, b: 1 });
    expect(d.perms).toEqual({ x: 1, y: 1, z: 0 });
  });

  it("嵌套 DynamicStructBuffer / 内联对象字面量", () => {
    const Inner = new DynamicStructBuffer("Inner", { x: uint16_t, y: float });
    const Outer = new DynamicStructBuffer("Outer", {
      head: uint8_t,
      inner: Inner,
      anon: { a: uint8_t, b: uint16_t },
    });
    type D = InferType<typeof Outer>;
    type _t = [
      Assert<Equals<D["head"], number>>,
      Assert<Equals<D["inner"], { x: number; y: number }>>,
      Assert<Equals<D["anon"], { a: number; b: number }>>
    ];

    // head(1) + x(2, 大端) + y(4, 3.0) + anon.a(1) + anon.b(2)
    const d = Outer.decode(
      Uint8Array.from([9, 0, 1, 0x40, 0x40, 0x00, 0x00, 8, 0, 0x41])
    );
    expect(d.head).toBe(9);
    expect(d.inner.x).toBe(1);
    expect(d.inner.y).toBe(3);
    expect(d.anon).toEqual({ a: 8, b: 0x41 });
  });

  it("递归推导: 三层嵌套", () => {
    const L3 = new DynamicStructBuffer("L3", { v: uint8_t });
    const L2 = new DynamicStructBuffer("L2", { leaf: L3, tag: uint8_t });
    const L1 = new DynamicStructBuffer("L1", { mid: L2, id: uint32_t });
    type Def1 = InferType<
      typeof L1 extends DynamicStructBuffer<infer S, any, any> ? S : never
    >;
    // Def1 已经是解码结果形状, InferDef 对形状是幂等的
    type D = InferDef<Def1>;
    type _t = [
      Assert<
        Equals<D, { mid: { leaf: { v: number }; tag: number }; id: number }>
      >
    ];

    // L2 的字段顺序是 leaf 在前: mid.leaf.v(1) + mid.tag(1) + id(4, 大端)
    const d = L1.decode(Uint8Array.from([0x22, 0x33, 0, 0, 0, 5]));
    expect(d.mid.leaf.v).toBe(0x22);
    expect(d.mid.tag).toBe(0x33);
    expect(d.id).toBe(5);
  });

  it("声明式字段: 字节段 / rest", () => {
    const F = new DynamicStructBuffer("F", {
      n: uint8_t,
      payload: uint8_t[ref("n")],
      tail: rest(),
    });
    type D = InferType<typeof F>;
    type _t = [
      Assert<Equals<D["n"], number>>,
      Assert<Equals<D["payload"], Uint8Array>>,
      Assert<Equals<D["tail"], Uint8Array>>
    ];

    const d = F.decode(Uint8Array.from([2, 0xaa, 0xbb, 1, 2, 3]));
    expect(d.payload).toEqual(Uint8Array.from([0xaa, 0xbb]));
    expect(d.tail).toEqual(Uint8Array.from([1, 2, 3]));
  });

  it("records 的值类型跟着子结构体走, 且恒为数组", () => {
    const Ent = new DynamicStructBuffer("Ent", { id: uint32_t, hp: uint16_t });
    const F = new DynamicStructBuffer("F", { ents: records(Ent) });
    type _t = [
      Assert<Equals<InferType<typeof F>["ents"], { id: number; hp: number }[]>>
    ];

    const d = F.decode(
      Uint8Array.from([0, 0, 0, 1, 0, 100, 0, 0, 0, 2, 0, 50])
    );
    expect(d.ents).toEqual([
      { id: 1, hp: 100 },
      { id: 2, hp: 50 },
    ]);
  });

  it("framed 的值类型来自 reader 的返回类型", () => {
    interface Op {
      op: number;
      body: Uint8Array;
    }
    const F = new DynamicStructBuffer("F", {
      ops: framed<Op>(
        {
          read(c) {
            const op = c.u8("op");
            const n = c.u8("n");
            return { op, body: c.bytes(n, "body") };
          },
        },
        {
          write(w, v) {
            w.u8(v.op);
            w.u8(v.body.length);
            w.bytes(v.body);
          },
        }
      ),
    });
    type _t = [Assert<Equals<InferType<typeof F>["ops"], Op[]>>];

    const d = F.decode(Uint8Array.from([1, 2, 0xaa, 0xbb, 3, 0]));
    expect(d.ops).toEqual([
      { op: 1, body: Uint8Array.from([0xaa, 0xbb]) },
      { op: 3, body: Uint8Array.from([]) },
    ]);
  });

  it("decode() 的结果类型是推导出来的, 字段名拼错编译期就报错", () => {
    // 定长 8 字节的名字段(没有长度前缀)只能按字节拿: 库里没有字符串类型, 编码
    // 归调用方, 拿到的永远是字节
    const Msg = new DynamicStructBuffer(
      "msg",
      {
        uknow1: uint16_t,
        msg_type: uint8_t,
        msg_size: uint16_t,
        msg: uint8_t[ref("msg_size")],
        name_size: uint8_t,
        name: uint8_t[ref("name_size")],
        text: uint8_t[1],
      },
      { littleEndian: true }
    );

    // uknow1(2) + msg_type(1) + msg_size(2) + msg[] + name_size(1) + name(2) + text(1)
    const d = Msg.decode(
      Uint8Array.from([0, 0, 0, 0, 0, 2, 0x41, 0x42, 0x41])
    );
    const n: number = d.msg_type;
    const bytes: Uint8Array = d.msg;
    const name: Uint8Array = d.name;
    const text: Uint8Array = d.text;
    expect([n, bytes.length, Array.from(name), Array.from(text)]).toEqual([
      0,
      0,
      [0x41, 0x42],
      [0x41],
    ]);

    // @ts-expect-error 字段不存在: 推导若退化成 {k: any} 这行不会报错, 断言就失效了
    void d.no_such_field;
  });

  it("encode() 的入参是 Partial, 长度字段可以不带", () => {
    const Msg = new DynamicStructBuffer("msg", {
      len: uint8_t,
      body: uint8_t[ref("len")],
    });
    const dv = Msg.encode({ body: new Uint8Array([1, 2, 3]) });
    expect(Array.from(new Uint8Array(dv.buffer))).toEqual([3, 1, 2, 3]);

    // @ts-expect-error 字段名拼错: Partial<D> 不是 {k: any}
    // 包在不会被调用的箭头里: @ts-expect-error 只压类型错误, 调用照样会执行
    void (() => Msg.encode({ bodyd: [1] }));
  });

  it("InferDef 可以单独用(不经过 DynamicStructBuffer)", () => {
    const c = uint8_t[ref("n")];
    const b = uint8_t[2];
    type D = InferDef<{
      a: typeof uint8_t;
      b: typeof b;
      c: typeof c;
    }>;
    type _t = [
      Assert<Equals<D, { a: number; b: Uint8Array; c: Uint8Array }>>
    ];

    const F = new DynamicStructBuffer("F", { n: uint8_t, c });
    type _t2 = [Assert<Equals<InferType<typeof F>["c"], Uint8Array>>];
    expect(F.decode(Uint8Array.from([2, 7, 8])).c).toEqual(
      Uint8Array.from([7, 8])
    );
  });

  it("子结构体的下标就是数组(deeps 的层数)", () => {
    const Item = new DynamicStructBuffer("item", { id: uint8_t });
    const F = new DynamicStructBuffer("F", {
      one: Item,
      list: Item[2],
      grid: Item[2][2],
    });
    type D = InferType<typeof F>;
    type _t = [
      Assert<Equals<D["one"], { id: number }>>,
      Assert<Equals<D["list"], { id: number }[]>>,
      Assert<Equals<D["grid"], { id: number }[][]>>
    ];

    const d = F.decode(
      Uint8Array.from([1, 2, 3, 4, 5, 6, 7])
    );
    expect([d.one, d.list, d.grid]).toEqual([
      { id: 1 },
      [{ id: 2 }, { id: 3 }],
      [
        [{ id: 4 }, { id: 5 }],
        [{ id: 6 }, { id: 7 }],
      ],
    ]);
  });

  it("variant 的分支字段并进父对象, 且都是可选的", () => {
    const Pkt = new DynamicStructBuffer("pkt", {
      msg_type: uint8_t,
      body: variant("msg_type", {
        1: { name: uint8_t[3] },
        2: { x: uint32_t, y: uint32_t },
      }),
    });
    type D = InferType<typeof Pkt>;
    type _t = [
      // 分支字段在父对象上, 不是 body.name
      Assert<Equals<D["name"], Uint8Array | undefined>>,
      Assert<Equals<D["x"], number | undefined>>
    ];

    // 分支字段是父对象的属性, 不是 body 的属性
    expect(Pkt.decode([1, 0x61, 0x62, 0x63])).toEqual({
      msg_type: 1,
      name: Uint8Array.from([0x61, 0x62, 0x63]),
    });
    expect(hex(Pkt.encode({ msg_type: 2, x: 1, y: 2 }))).toBe(
      "02 00 00 00 01 00 00 00 02"
    );

    // @ts-expect-error 分支字段名拼错
    void (() => Pkt.encode({ msg_type: 1, nam: "abc" }));
  });

  it("字节段的 decode 值和 encode 入参是同一种类型", () => {
    const F = new DynamicStructBuffer("F", {
      op: uint8_t,
      body: rest(),
    });
    type D = InferType<typeof F>;
    type E = InferEncodeDef<typeof F.struct>;
    type _t = [
      Assert<Equals<D["body"], Uint8Array>>,
      // 收窄到一种之后, 写回去和解出来就是同一个类型
      Assert<Equals<E["body"], Uint8Array>>
    ];

    F.encode({ body: Uint8Array.from([1, 2, 3]) });
    // @ts-expect-error number[] 不再被接受: 字节只有 Uint8Array 一种形态
    void (() => F.encode({ body: [1, 2, 3] }));
    expect(Array.from(F.decode([7, 9]).body)).toEqual([9]);
  });
});

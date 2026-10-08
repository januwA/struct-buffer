import {
  uint32_t,
  int8_t,
  uint8_t,
  uint16_t,
  int16_t,
  int64_t,
  uint64_t,
  double,
  bytes,
  list,
  struct,
  makeDataView,
  sview,
  sbytes2 as b2,
  skip,
  skipUntil,
  ref,
  sbytes,
} from "../src";

describe("test decode and encode", () => {
  it("parse list item dynamic size", () => {
    const itemStruct = struct(
      "item",
      {
        inc_id: uint32_t,
        id: uint32_t,
        define_id: uint32_t,
        type: uint16_t,
      },
      {
        littleEndian: true,
      },
    );
    const packetStruct = struct(
      "Packet",
      {
        seq: uint16_t,
        box_id: uint32_t,
        count: uint8_t,
        _pad1: skip(2),
        items: list(itemStruct, ref("count"), {
          sync: {
            pattern: (_prev, first) => uint32_t.encode(first.id, true),
            offset: -4,
          },
        }),
      },
      {
        littleEndian: true,
      },
    );

    const data = packetStruct.decode(
      sbytes(
        `00 5d bd 25 00 00 04 ff ff 5d 4c 42 48 09 00 9a 08 35 78 d1 01 34 01 00 00 00 00 00 00 00 00 00 00 00 00 01 01 fa ff 7c 01 00 00 ff ff ff ff ff ff ff ff 01 00 00 00 ff ff ff ff ff 00 00 00 00 00 00 00 00 00 00 00 00 5e 4c 42 48 09 00 9a 0827 4e cb 01 05 00 00 00 00 00 00 00 00 00 00 00 00 00 01 01 fa 01 36 00 00 00 f5 15 05 00 34 00 00 00 01 00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 00 00 00 00 00 5f 4c 42 48 09 00 9a 08 b1 f9 9b 00 16 00 00 00 00 00 00 00 00 00 00 00 00 00 77 00 00 77 00 00 01 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ff ff 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 60 4c 42 48 09 00 9a 08 54 25 9a 00 02 00 00 00 00 00 00 00 00 00 00 00 00 00 72 00 00 72 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 c7 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00`,
      ),
    );

    expect(data.box_id).toBe(uint32_t.decode(sbytes("bd 25 00 00"), true));
    expect(data.count).toBe(uint8_t.decode(sbytes("04"), true));
    expect(data.items.length).toBe(4);
    expect(data.items[0].inc_id).toBe(
      uint32_t.decode(sbytes("5d 4c 42 48"), true),
    );
    expect(data.items[0].id).toBe(uint32_t.decode(sbytes("09 00 9a 08"), true));
    expect(data.items[0].define_id).toBe(
      uint32_t.decode(sbytes("35 78 d1 01"), true),
    );
    expect(data.items[0].type).toBe(uint16_t.decode(sbytes("34 01"), true));

    expect(data.items[1].inc_id).toBe(
      uint32_t.decode(sbytes("5e 4c 42 48"), true),
    );
    expect(data.items[1].id).toBe(uint32_t.decode(sbytes("09 00 9a 08"), true));
    expect(data.items[1].define_id).toBe(
      uint32_t.decode(sbytes("27 4e cb 01"), true),
    );
    expect(data.items[1].type).toBe(uint16_t.decode(sbytes("05 00"), true));

    expect(data.items[2].inc_id).toBe(
      uint32_t.decode(sbytes("5f 4c 42 48"), true),
    );
    expect(data.items[2].id).toBe(uint32_t.decode(sbytes("09 00 9a 08"), true));
    expect(data.items[2].define_id).toBe(
      uint32_t.decode(sbytes("b1 f9 9b 00"), true),
    );
    expect(data.items[2].type).toBe(uint16_t.decode(sbytes("16 00"), true));

    expect(data.items[3].inc_id).toBe(
      uint32_t.decode(sbytes("60 4c 42 48"), true),
    );
    expect(data.items[3].id).toBe(uint32_t.decode(sbytes("09 00 9a 08"), true));
    expect(data.items[3].define_id).toBe(
      uint32_t.decode(sbytes("54 25 9a 00"), true),
    );
    expect(data.items[3].type).toBe(uint16_t.decode(sbytes("02 00"), true));
  });

  it("test skipUntil with dynamic pattern", () => {
    const itemStruct = struct(
      "item",
      {
        inc_id: uint32_t,
        id: uint32_t,
        define_id: uint32_t,
        type: uint16_t,
        _next: skipUntil((ctx) => uint32_t.encode(ctx.id, true), {
          offset: -4,
          optional: true,
        }),
      },
      {
        littleEndian: true,
      },
    );
    const lootPacketStruct = struct(
      "LootPacket",
      {
        seq: uint16_t,
        box_id: uint32_t,
        count: uint8_t,
        _pad1: skip(2),
        items: list(itemStruct, ref("count")),
      },
      {
        littleEndian: true,
      },
    );

    const data = lootPacketStruct.decode(
      sbytes(
        `00 5d bd 25 00 00 04 ff ff 5d 4c 42 48 09 00 9a 08 35 78 d1 01 34 01 00 00 00 00 00 00 00 00 00 00 00 00 01 01 fa ff 7c 01 00 00 ff ff ff ff ff ff ff ff 01 00 00 00 ff ff ff ff ff 00 00 00 00 00 00 00 00 00 00 00 00 5e 4c 42 48 09 00 9a 0827 4e cb 01 05 00 00 00 00 00 00 00 00 00 00 00 00 00 01 01 fa 01 36 00 00 00 f5 15 05 00 34 00 00 00 01 00 00 00 01 00 00 00 04 00 00 00 00 00 00 00 00 00 00 00 00 5f 4c 42 48 09 00 9a 08 b1 f9 9b 00 16 00 00 00 00 00 00 00 00 00 00 00 00 00 77 00 00 77 00 00 01 0a 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 ff ff 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 60 4c 42 48 09 00 9a 08 54 25 9a 00 02 00 00 00 00 00 00 00 00 00 00 00 00 00 72 00 00 72 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 01 c7 01 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00`,
      ),
    );

    expect(data.box_id).toBe(uint32_t.decode(sbytes("bd 25 00 00"), true));
    expect(data.count).toBe(uint8_t.decode(sbytes("04"), true));
    expect(data.items.length).toBe(4);
    expect(data.items[0].inc_id).toBe(
      uint32_t.decode(sbytes("5d 4c 42 48"), true),
    );
    expect(data.items[1].inc_id).toBe(
      uint32_t.decode(sbytes("5e 4c 42 48"), true),
    );
    expect(data.items[2].inc_id).toBe(
      uint32_t.decode(sbytes("5f 4c 42 48"), true),
    );
    expect(data.items[3].inc_id).toBe(
      uint32_t.decode(sbytes("60 4c 42 48"), true),
    );
  });

  it("test decode and encode", () => {
    const Player = struct("Player", {
      hp: uint32_t,
      mp: uint32_t,
      name: bytes(3),
    });
    const obj = {
      hp: 10,
      mp: 100,
      name: new Uint8Array([0x61, 0x62, 0x63]),
    };
    const view: DataView = makeDataView([
      0,
      0,
      0,
      10, // hp  = 10
      0,
      0,
      0,
      100, // mp  = 100
      0x61,
      0x62,
      0x63, // "abc"
    ]);

    expect(Player.decode(view)).toEqual(obj);
    expect(sview(Player.encode(obj))).toBe(sview(view));
    expect(Player.encode(obj).byteLength).toBe(11);
  });

  it("test uint32_t encode", () => {
    const view = list(uint32_t, 2).encode([1, 2]);
    expect(view.byteLength).toBe(8);
    expect(sview(view)).toBe(sview(makeDataView([0, 0, 0, 1, 0, 0, 0, 2])));
  });

  it("test uint32_t decode", () => {
    const data = list(uint32_t, 2).decode(
      makeDataView([0, 0, 0, 1, 0, 0, 0, 2]),
    );

    expect(data.length).toBe(2);
    expect(data).toEqual([1, 2]);
  });
});

describe("test int8_t", () => {
  it("test decode and encode", () => {
    const view = b2("abcd", new TextEncoder());
    const obj = {
      a: 0x61,
      b: [0x62],
      c: [0x63, 0x64],
    };
    const Test = struct("Test", {
      a: int8_t,
      b: list(int8_t, 1),
      c: list(int8_t, 2),
    });
    expect(Test.decode(view)).toEqual(obj);
    expect(sview(Test.encode(obj))).toBe(sview(view));
    expect(Test.encode(obj).byteLength).toBe(4);
  });

  it("test int8_t and uint8_t", () => {
    const Test = struct("Test", {
      a: int8_t,
      b: uint8_t,
    });
    const data = Test.decode(makeDataView([0xff, 0xff]));
    expect(data).toEqual({
      a: -1,
      b: 255,
    });
  });
});

describe("test pos", () => {
  let view: DataView;
  let Pos: ReturnType<typeof struct>;
  const obj = {
    pos: [
      [1.23, 22.66],
      [140.67, 742.45],
      [123.23, 1231.23],
      [534.23, 873.35],
    ],
  };
  beforeAll(() => {
    // 原 pack("8d", …) 是大端; 这里直接用原生 DataView 写大端 double,
    // 不经过库的编码器 —— 夹具必须独立于被测代码
    view = new DataView(new ArrayBuffer(8 * 8));
    [1.23, 22.66, 140.67, 742.45, 123.23, 1231.23, 534.23, 873.35].forEach(
      (v, i) => view.setFloat64(i * 8, v, false),
    );

    Pos = struct("Pos", {
      pos: list(list(double, 2), 4),
    });
  });

  it("test decode", () => {
    expect(Pos.decode(view)).toEqual(obj);
  });

  it("test decode", () => {
    expect(sview(Pos.encode(obj))).toBe(sview(view));
  });

  it("test byteLength", () => {
    expect(Pos.encode(obj).byteLength).toBe(2 * 8 * 4);
  });
});

describe("test struct nesting", () => {
  /*
    typedef struct _XINPUT_STATE {
      uint32_t          dwPacketNumber;
      XINPUT_GAMEPAD Gamepad;
    } XINPUT_STATE, *PXINPUT_STATE;


    typedef struct _XINPUT_GAMEPAD {
      uint16_t  wButtons;
      uint8_t  bLeftTrigger;
      uint8_t  bRightTrigger;
      SHORT sThumbLX;
      SHORT sThumbLY;
      SHORT sThumbRX;
      SHORT sThumbRY;
    } XINPUT_GAMEPAD, *PXINPUT_GAMEPAD;
  */

  let XINPUT_STATE: ReturnType<typeof struct>;
  let XINPUT_GAMEPAD: ReturnType<typeof struct>;
  const obj = {
    dwPacketNumber: 0,
    Gamepad: {
      wButtons: 1,
      bLeftTrigger: 0,
      bRightTrigger: 0,
      sThumbLX: 1,
      sThumbLY: 2,
      sThumbRX: 3,
      sThumbRY: 4,
    },
  };
  beforeAll(() => {
    XINPUT_GAMEPAD = struct("XINPUT_GAMEPAD", {
      wButtons: uint16_t,
      bLeftTrigger: uint8_t,
      bRightTrigger: uint8_t,
      sThumbLX: int16_t,
      sThumbLY: int16_t,
      sThumbRX: int16_t,
      sThumbRY: int16_t,
    });
    XINPUT_STATE = struct("XINPUT_STATE", {
      dwPacketNumber: uint32_t,
      Gamepad: XINPUT_GAMEPAD,
    });
  });

  it("test decode", () => {
    // uint32_t + uint16_t + uint8_t[2] + int16[4]
    const raw = makeDataView([
      0,
      0,
      0,
      0, // dwPacketNumber
      0,
      1, // wButtons
      0,
      0, // bLeftTrigger / bRightTrigger
      0,
      1,
      0,
      2,
      0,
      3,
      0,
      4, // sThumbL* / sThumbR*
    ]);
    const data = XINPUT_STATE.decode(raw);
    expect(data).toEqual(obj);
  });

  it("test encode", () => {
    const view = XINPUT_STATE.encode(obj);
    expect(sview(view)).toBe(
      sview(makeDataView([0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4])),
    );
  });

  it("test byteLength", () => {
    expect(XINPUT_STATE.encode(obj).byteLength).toBe(16);
  });
});

describe("test struct list", () => {
  let user: ReturnType<typeof struct>;
  let users: ReturnType<typeof struct>;
  const obj = {
    users: [
      {
        name: new Uint8Array([0x61, 0x31]),
        name2: new Uint8Array([0x61, 0x32]),
      },
      {
        name: new Uint8Array([0x62, 0x31]),
        name2: new Uint8Array([0x62, 0x32]),
      },
    ],
  };
  beforeAll(() => {
    user = struct("User", {
      name: bytes(2),
      name2: bytes(2),
    });
    users = struct("Users", {
      users: list(user, 2),
    });
  });

  it("test decode", () => {
    expect(users.decode(b2("a1a2b1b2", new TextEncoder()))).toEqual(obj);
    expect(list(user, 2).decode(b2("a1a2b1b2", new TextEncoder())).length).toBe(
      2,
    );
  });

  it("test encode", () => {
    expect(sview(users.encode(obj))).toBe(
      sview(b2("a1a2b1b2", new TextEncoder())),
    );
  });

  it("test byteLength", () => {
    expect(users.encode(obj).byteLength).toBe(8);
  });
});

describe("test struct Multilevel array", () => {
  let player: ReturnType<typeof struct>;
  let players: ReturnType<typeof struct>;
  let view: DataView;
  const obj = {
    players: [
      [
        { hp: 1, mp: 1 },
        { hp: 2, mp: 2 },
      ],
      [
        { hp: 3, mp: 3 },
        { hp: 4, mp: 4 },
      ],
    ],
  };
  beforeAll(() => {
    player = struct("Player", {
      hp: uint32_t,
      mp: uint32_t,
    });

    players = struct("Players", {
      players: list(list(player, 2), 2),
    });

    view = makeDataView([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 3, 0,
      0, 0, 4, 0, 0, 0, 4,
    ]);
  });

  it("test decode", () => {
    expect(players.decode(view)).toEqual(obj);
  });

  it("test encode", () => {
    expect(sview(players.encode(obj))).toBe(sview(view));
  });

  it("test byteLength", () => {
    expect(player.encode({ hp: 1, mp: 1 }).byteLength).toBe(8);
    expect(players.encode(obj).byteLength).toBe(32);
  });
});

describe("test int64_t / uint64_t", () => {
  it("int64_t 真的按有符号解, 负数不是一大坨正数", () => {
    // int64_t 之前是从没显式传 unsigned 的 longlong 来的, 落进默认 true,
    // 于是走的是 getBigUint64 —— 0xFFFFFFFFFFFFFFFF 解出来是 18446744073709551615
    const view = makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(int64_t.decode(view)).toBe(-1);
    expect(
      int64_t.decode(
        makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]),
      ),
    ).toBe(-2);
  });

  it("uint64_t 走无符号解", () => {
    const view = makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(uint64_t.decode(view)).toBe(18446744073709551615);
  });

  it("解码结果始终是 number, 不是 bigint", () => {
    // DataView 的 64 位访问器只给 bigint, 但声明的值类型是 number:
    // 统一收窄, 调用方不用再自己判断类型
    const view = makeDataView([0, 0, 0, 0, 0, 0, 0x01, 0x00]);
    const decoded = int64_t.decode(view);
    expect(typeof decoded).toBe("number");
    expect(decoded).toBe(256);
  });

  it("编码接受 number", () => {
    expect(sview(int64_t.encode(-1))).toBe(
      sview(makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])),
    );
    expect(sview(uint64_t.encode(256))).toBe(
      sview(makeDataView([0, 0, 0, 0, 0, 0, 0x01, 0x00])),
    );
  });

  it("列表往返", () => {
    const view = makeDataView([
      0, 0, 0, 0, 0, 0, 0, 1, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    ]);
    expect(list(int64_t, 2).decode(view)).toEqual([1, -2]);
    expect(sview(list(int64_t, 2).encode([1, -2]))).toBe(sview(view));
  });
});

describe("多层原始类型", () => {
  const wire = makeDataView([0, 1, 0, 2, 0, 3, 0, 4, 0, 5, 0, 6, 0, 7, 0, 8]);
  const nested = [
    [
      [1, 2],
      [3, 4],
    ],
    [
      [5, 6],
      [7, 8],
    ],
  ];

  it("三层形状 encode 完整写出, 不再从第 3 层起静默写 0", () => {
    // 旧实现用 obj.flat() 只拍一层 ⇒ 元素变成 [1,2] 这种数组 ⇒ 访问器强转成 0
    const T = list(list(list(uint16_t, 2), 2), 2);
    expect(sview(T.encode(nested))).toBe(sview(wire));
    expect(T.decode(wire)).toEqual(nested);
  });

  it("作为字段的三层形状同样完整", () => {
    const S = struct("S", { m: list(list(list(uint16_t, 2), 2), 2) });
    const view = S.encode({ m: nested });
    expect(sview(view)).toBe(sview(wire));
    expect(S.decode(view).m).toEqual(nested);
  });
});

describe("字节段 encode 只收 Uint8Array", () => {
  it("number[] 直接报错, 不再静默写 0", () => {
    expect(() => bytes(2).encode([1, 2] as any)).toThrow(/Uint8Array/);
  });

  it("Uint8Array 正常往返", () => {
    expect(sview(bytes(2).encode(new Uint8Array([1, 2])))).toBe("01 02");
  });
});

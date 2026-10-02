import {
  uint32_t,
  string_t,
  sizeof,
  int8_t,
  uint8_t,
  uint16_t,
  int16_t,
  int64_t,
  uint64_t,
  double,
  StructBuffer,
  typedef,
  makeDataView,
  sview,
  sbytes2 as b2,
} from "../src";

describe("test decode and encode", () => {
  it("test decode and encode", () => {
    const struct = new StructBuffer("Player", {
      hp: uint32_t,
      mp: uint32_t,
      name: string_t[3],
    });
    const obj = {
      hp: 10,
      mp: 100,
      name: "abc",
    };
    const view: DataView = makeDataView([
      0, 0, 0, 10, // hp  = 10
      0, 0, 0, 100, // mp  = 100
      0x61, 0x62, 0x63, // "abc"
    ]);

    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(11);
  });

  it("test uint32_t encode", () => {
    const view = uint32_t[2].encode([1, 2]);
    expect(view.byteLength).toBe(8);
    expect(sview(view)).toBe(sview(makeDataView([0, 0, 0, 1, 0, 0, 0, 2])));
  });

  it("test uint32_t decode", () => {
    const data = uint32_t[2].decode(makeDataView([0, 0, 0, 1, 0, 0, 0, 2]));

    expect(data.length).toBe(2);
    expect(data).toEqual([1, 2]);
  });
});

describe("test string_t", () => {
  it("test decode and encode", () => {
    let struct = new StructBuffer("Test", {
      a: string_t,
      b: string_t,
      c: string_t[2],
    });
    const obj = {
      a: "a",
      b: "b",
      c: "cd",
    };
    const view = b2("abcd");
    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(4);
  });

  it("test names", () => {
    const obj = ["abcd", "abce", "abcf"] as any;
    const view = string_t[3][4].encode(obj);
    const names = string_t[3][4].decode(view);
    expect(names).toEqual(obj);
  });
});

describe("test int8_t", () => {
  it("test decode and encode", () => {
    const view = b2("abcd");
    const obj = {
      a: 0x61,
      b: [0x62],
      c: [0x63, 0x64],
    };
    let struct = new StructBuffer("Test", {
      a: int8_t,
      b: int8_t[1],
      c: int8_t[2],
    });
    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(4);
  });

  it("test int8_t and uint8_t", () => {
    const s = new StructBuffer("Test", {
      a: int8_t,
      b: uint8_t,
    });
    const data = s.decode(makeDataView([0xff, 0xff]));
    expect(data).toEqual({
      a: -1,
      b: 255,
    });
  });
});

describe("test pos", () => {
  let view: DataView;
  let struct: StructBuffer<any>;
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
      (v, i) => view.setFloat64(i * 8, v, false)
    );

    struct = new StructBuffer("Pos", {
      pos: double[4][2],
    });
  });

  it("test decode", () => {
    expect(struct.decode(view)).toEqual(obj);
  });

  it("test decode", () => {
    expect(sview(struct.encode(obj))).toBe(sview(view));
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(2 * 8 * 4);
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

  let XINPUT_STATE: StructBuffer<any>;
  let XINPUT_GAMEPAD: StructBuffer<any>;
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
    XINPUT_GAMEPAD = new StructBuffer("XINPUT_GAMEPAD", {
      wButtons: uint16_t,
      bLeftTrigger: uint8_t,
      bRightTrigger: uint8_t,
      sThumbLX: int16_t,
      sThumbLY: int16_t,
      sThumbRX: int16_t,
      sThumbRY: int16_t,
    });
    XINPUT_STATE = new StructBuffer("XINPUT_STATE", {
      dwPacketNumber: uint32_t,
      Gamepad: XINPUT_GAMEPAD,
    });
  });

  it("test decode", () => {
    // uint32_t + uint16_t + uint8_t[2] + int16[4]
    const raw = makeDataView([
      0, 0, 0, 0, // dwPacketNumber
      0, 1, // wButtons
      0, 0, // bLeftTrigger / bRightTrigger
      0, 1, 0, 2, 0, 3, 0, 4, // sThumbL* / sThumbR*
    ]);
    const data = XINPUT_STATE.decode(raw);
    expect(data).toEqual(obj);
  });

  it("test encode", () => {
    const view = XINPUT_STATE.encode(obj);
    expect(sview(view)).toBe(
      sview(
        makeDataView([
          0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 2, 0, 3, 0, 4,
        ])
      )
    );
  });

  it("test byteLength", () => {
    expect(XINPUT_STATE.byteLength).toBe(16);
  });
});

describe("test typedef", () => {
  it("test typedef", () => {
    const HANDLE = typedef("HANDLE", uint32_t);
    expect(HANDLE.size).toBe(4);
    expect(HANDLE.unsigned).toBe(true);
  });
});

describe("test struct list", () => {
  let user: StructBuffer<any>;
  let users: StructBuffer<any>;
  const obj = {
    users: [
      { name: "a1", name2: "a2" },
      { name: "b1", name2: "b2" },
    ],
  };
  beforeAll(() => {
    user = new StructBuffer("User", {
      name: string_t[2],
      name2: string_t[2],
    });
    users = new StructBuffer("Users", {
      users: user[2],
    });
  });

  it("test decode", () => {
    expect(users.decode(b2("a1a2b1b2"))).toEqual(obj);
    expect(user[2].decode(b2("a1a2b1b2")).length).toBe(2);
  });

  it("test encode", () => {
    expect(sview(users.encode(obj))).toBe(sview(b2("a1a2b1b2")));
  });

  it("test byteLength", () => {
    expect(users.byteLength).toBe(8);
    expect(sizeof(users)).toBe(8);
  });
});

describe("test struct Multilevel array", () => {
  let player: StructBuffer<any>;
  let players: StructBuffer<any>;
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
    player = new StructBuffer("Player", {
      hp: uint32_t,
      mp: uint32_t,
    });

    players = new StructBuffer("Players", {
      players: player[2][2],
    });

    view = makeDataView([
      0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 3, 0, 0, 0, 3, 0, 0, 0, 4,
      0, 0, 0, 4,
    ]);
  });

  it("test decode", () => {
    expect(players.decode(view)).toEqual(obj);
  });

  it("test encode", () => {
    expect(sview(players.encode(obj))).toBe(sview(view));
  });

  it("test byteLength", () => {
    expect(player.byteLength).toBe(8);
    expect(players.byteLength).toBe(32);
  });
});

describe("test int64_t / uint64_t", () => {
  it("int64_t 真的按有符号解, 负数不是一大坨正数", () => {
    // int64_t 之前是从没显式传 unsigned 的 longlong 来的, 落进默认 true,
    // 于是走的是 getBigUint64 —— 0xFFFFFFFFFFFFFFFF 解出来是 18446744073709551615
    const view = makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff]);
    expect(int64_t.decode(view)).toBe(-1);
    expect(int64_t.decode(makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe]))).toBe(-2);
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
    expect(sview(int64_t.encode(-1))).toBe(sview(makeDataView([0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff])));
    expect(sview(uint64_t.encode(256))).toBe(sview(makeDataView([0, 0, 0, 0, 0, 0, 0x01, 0x00])));
  });

  it("列表往返", () => {
    const view = makeDataView([
      0, 0, 0, 0, 0, 0, 0, 1,
      0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xfe,
    ]);
    expect(int64_t[2].decode(view)).toEqual([1, -2]);
    expect(sview(int64_t[2].encode([1, -2]))).toBe(sview(view));
  });
});

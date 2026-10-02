import {
  DWORD,
  string_t,
  uint32_t,
  sizeof,
  char,
  BYTE,
  WORD,
  int16_t,
  double,
  StructBuffer,
  uchar,
  typedef,
  makeDataView,
  sview,
  sbytes2 as b2,
} from "../src";

describe("test decode and encode", () => {
  it("test decode and encode", () => {
    const struct = new StructBuffer("Player", {
      hp: DWORD,
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

  it("test dword encode", () => {
    const view = DWORD[2].encode([1, 2]);
    expect(view.byteLength).toBe(8);
    expect(sview(view)).toBe(sview(makeDataView([0, 0, 0, 1, 0, 0, 0, 2])));
  });

  it("test dword decode", () => {
    const data = DWORD[2].decode(makeDataView([0, 0, 0, 1, 0, 0, 0, 2]));

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

describe("test char", () => {
  it("test decode and encode", () => {
    const view = b2("abcd");
    const obj = {
      a: 0x61,
      b: [0x62],
      c: [0x63, 0x64],
    };
    let struct = new StructBuffer("Test", {
      a: char,
      b: char[1],
      c: char[2],
    });
    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(4);
  });

  it("test char and uchar", () => {
    const s = new StructBuffer("Test", {
      a: char,
      b: uchar,
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
      DWORD          dwPacketNumber;
      XINPUT_GAMEPAD Gamepad;
    } XINPUT_STATE, *PXINPUT_STATE;


    typedef struct _XINPUT_GAMEPAD {
      WORD  wButtons;
      BYTE  bLeftTrigger;
      BYTE  bRightTrigger;
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
      wButtons: WORD,
      bLeftTrigger: BYTE,
      bRightTrigger: BYTE,
      sThumbLX: int16_t,
      sThumbLY: int16_t,
      sThumbRX: int16_t,
      sThumbRY: int16_t,
    });
    XINPUT_STATE = new StructBuffer("XINPUT_STATE", {
      dwPacketNumber: DWORD,
      Gamepad: XINPUT_GAMEPAD,
    });
  });

  it("test decode", () => {
    // DWORD + WORD + BYTE[2] + int16[4]
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
    const HANDLE = typedef("HANDLE", DWORD);
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
      hp: DWORD,
      mp: DWORD,
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

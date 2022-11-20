import {
  string_t,
  uint32_t,
  uint64_t,
  int16_t,
  double,
  StructBuffer,
  typedef,
  pack,
  sview,
  sbytes2 as b2,
  uint16_t,
  uint8_t,
} from "../src";

describe("test decode and encode", () => {
  it("test decode and encode", () => {
    const struct = new StructBuffer({
      hp: uint32_t,
      mp: uint32_t,
      name: string_t[3],
    });
    const obj = {
      hp: 10,
      mp: 100,
      name: "abc",
    };
    const view: DataView = pack("II3s", obj.hp, obj.mp, obj.name);

    expect(struct.decode(view)).toEqual(obj);
    expect(sview(struct.encode(obj))).toBe(sview(view));
    expect(struct.byteLength).toBe(11);
  });

  it("test uint32_t encode", () => {
    const view = uint32_t[2].encode([1, 2]);
    expect(view.byteLength).toBe(8);
    expect(sview(view)).toBe(sview(pack("II", 1, 2)));

    const data = uint32_t[2].decode(view);

    expect(data.length).toBe(2);
    expect(data).toEqual([1, 2]);
  });

  it("test uint64_t encode", () => {
    const view = uint64_t[2].encode([1n, 2n]);
    expect(view.byteLength).toBe(16);
    expect(sview(view)).toBe(sview(pack("QQ", 1, 2)));

    const data = uint64_t[2].decode(view);

    expect(data.length).toBe(2);
    expect(data).toEqual([1n, 2n]);
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
    view = pack(
      "8d",
      1.23,
      22.66,
      140.67,
      742.45,
      123.23,
      1231.23,
      534.23,
      873.35
    );

    struct = new StructBuffer({
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
    expect(struct.byteLength).toBe(8 * 4 * 2);
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
    XINPUT_GAMEPAD = new StructBuffer({
      wButtons: uint16_t,
      bLeftTrigger: uint8_t,
      bRightTrigger: uint8_t,
      sThumbLX: int16_t,
      sThumbLY: int16_t,
      sThumbRX: int16_t,
      sThumbRY: int16_t,
    });
    XINPUT_STATE = new StructBuffer({
      dwPacketNumber: uint32_t,
      Gamepad: XINPUT_GAMEPAD,
    });
  });

  it("test decode", () => {
    const data = XINPUT_STATE.decode(pack("IH2B4h", 0, 1, 0, 0, 1, 2, 3, 4));
    expect(data).toEqual(obj);
  });

  it("test encode", () => {
    const view = XINPUT_STATE.encode(obj);
    expect(sview(view)).toBe(sview(pack("IH2B4h", 0, 1, 0, 0, 1, 2, 3, 4)));
  });

  it("test byteLength", () => {
    expect(XINPUT_STATE.byteLength).toBe(16);
  });
});

describe("test typedef", () => {
  it("test typedef", () => {
    const HANDLE = typedef(uint32_t);
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
    user = new StructBuffer({
      name: string_t[2],
      name2: string_t[2],
    });
    users = new StructBuffer({
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
    player = new StructBuffer({
      hp: uint32_t,
      mp: uint32_t,
    });

    players = new StructBuffer({
      players: player[2][2],
    });

    view = pack("8I", 1, 1, 2, 2, 3, 3, 4, 4);
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

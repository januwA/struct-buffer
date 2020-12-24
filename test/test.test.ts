import {
  DWORD,
  string_t,
  uint32_t,
  sizeof,
  char,
  BYTE,
  WORD,
  QWORD,
  int8_t,
  int16_t,
  int32_t,
  int64_t,
  uint8_t,
  uint16_t,
  uint64_t,
  float,
  double,
  StructBuffer,
  display,
} from "../src";

describe("test decode and encode", () => {
  let struct: StructBuffer;

  beforeAll(() => {
    struct = new StructBuffer({
      hp: DWORD,
      mp: uint32_t,
      name: string_t[3],
    });
  });

  it("test decode", () => {
    const buffer = new Uint8Array([
      0,
      0,
      0,
      0x0a,
      0,
      0,
      0,
      0x64,
      0x61,
      0x62,
      0x63,
    ]);
    const data = struct.decode(new DataView(buffer.buffer));
    expect(data.hp).toBe(0x0a);
    expect(data.mp).toBe(100);
    expect(data.name).toBe("abc");
  });

  it("test encode", () => {
    const view = struct.encode({
      hp: 10,
      mp: 100,
      name: "abc",
    });

    expect(view.getUint32(0)).toBe(10);
    expect(view.getUint32(4)).toBe(100);
    expect(view.getUint8(8)).toBe(0x61); // a
    expect(view.getUint8(9)).toBe(0x62); // b
    expect(view.getUint8(10)).toBe(0x63); // c
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(11);
  });
});

describe("test string_t", () => {
  let struct: StructBuffer;

  beforeAll(() => {
    struct = new StructBuffer({
      a: string_t,
      b: string_t,
      c: string_t[2],
    });
  });

  it("test decode", () => {
    const buffer = new Uint8Array([0x61, 0x62, 0x63, 0x64]);
    const data = struct.decode(new DataView(buffer.buffer));
    expect(data.a).toBe("a");
    expect(data.b).toBe("b");
    expect(data.c).toBe("cd");
  });

  it("test encode", () => {
    const view = struct.encode({
      a: "a",
      b: "b",
      c: "cd",
    });
    expect(view.getUint8(0)).toBe(0x61); // a
    expect(view.getUint8(1)).toBe(0x62); // b
    expect(view.getUint8(2)).toBe(0x63); // c
    expect(view.getUint8(3)).toBe(0x64); // d
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(4);
  });
});

describe("test char", () => {
  let struct: StructBuffer;

  beforeAll(() => {
    struct = new StructBuffer({
      a: char,
      b: char[1],
      c: char[2],
    });
  });

  it("test decode", () => {
    const buffer = new Uint8Array([0x61, 0x62, 0x63, 0x64]);
    const data = struct.decode(new DataView(buffer.buffer));

    expect(data.a).toBe(0x61);
    expect(data.b).toEqual([0x62]);
    expect(data.c).toEqual([0x63, 0x64]);
  });

  it("test encode", () => {
    const view = struct.encode({
      a: 0x61,
      b: [0x62],
      c: [0x63, 0x64],
    });
    expect(view.getUint8(0)).toBe(0x61); // a
    expect(view.getUint8(1)).toBe(0x62); // b
    expect(view.getUint8(2)).toBe(0x63); // c
    expect(view.getUint8(3)).toBe(0x64); // d
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(4);
  });
});

describe("test sizeof", () => {
  it("test byte", () => {
    expect(sizeof(BYTE)).toBe(1);
    expect(sizeof(BYTE[10])).toBe(10);
  });

  it("test WORD", () => {
    expect(sizeof(WORD)).toBe(2);
    expect(sizeof(WORD[10])).toBe(20);
    expect(sizeof(WORD[3][4])).toBe(24);
  });

  it("test DWORD", () => {
    expect(sizeof(DWORD)).toBe(4);
    expect(sizeof(DWORD[10])).toBe(40);
    expect(sizeof(DWORD[2][4])).toBe(32);
  });

  it("test QWORD", () => {
    expect(sizeof(QWORD)).toBe(8);
    expect(sizeof(QWORD[10])).toBe(80);
  });

  it("test int8_t", () => {
    expect(sizeof(int8_t)).toBe(1);
    expect(sizeof(int8_t[10])).toBe(10);
  });
  it("test int16_t", () => {
    expect(sizeof(int16_t)).toBe(2);
    expect(sizeof(int16_t[10])).toBe(20);
  });
  it("test int32_t", () => {
    expect(sizeof(int32_t)).toBe(4);
    expect(sizeof(int32_t[10])).toBe(4 * 10);
  });
  it("test int64_t", () => {
    expect(sizeof(int64_t)).toBe(8);
    expect(sizeof(int64_t[10])).toBe(8 * 10);
  });
  it("test uint8_t", () => {
    expect(sizeof(uint8_t)).toBe(1);
    expect(sizeof(uint8_t[10])).toBe(10);
  });
  it("test uint16_t", () => {
    expect(sizeof(uint16_t)).toBe(2);
    expect(sizeof(uint16_t[10])).toBe(20);
  });
  it("test uint32_t", () => {
    expect(sizeof(uint32_t)).toBe(4);
    expect(sizeof(uint32_t[10])).toBe(4 * 10);
  });
  it("test uint64_t", () => {
    expect(sizeof(uint64_t)).toBe(8);
    expect(sizeof(uint64_t[10])).toBe(8 * 10);
  });
  it("test float", () => {
    expect(sizeof(float)).toBe(4);
    expect(sizeof(float[10])).toBe(4 * 10);
  });
  it("test double", () => {
    expect(sizeof(double)).toBe(8);
    expect(sizeof(double[10])).toBe(8 * 10);
  });
  it("test char", () => {
    expect(sizeof(char)).toBe(1);
    expect(sizeof(char[10])).toBe(10);
  });
  it("test string_t", () => {
    expect(sizeof(string_t)).toBe(1);
    expect(sizeof(string_t[10])).toBe(10);
  });
});

describe("test display", () => {
  let view: DataView;
  let fview: DataView;
  let dview: DataView;
  beforeAll(() => {
    const buf = new Uint8Array([
      0x01,
      0x02,
      0x03,
      0x04,
      0x05,
      0x06,
      0x07,
      0x08,
    ]);
    view = new DataView(buf.buffer);

    fview = new DataView(new ArrayBuffer(8));
    fview.setFloat32(0, 22.2);
    fview.setFloat32(4, 10.1);

    dview = new DataView(new ArrayBuffer(8));
    dview.setFloat64(0, 22.23456);
  });
  it("test byte", () => {
    const data = display(view, BYTE, false);
    expect(data[0].value).toBe(1);
    expect(data[1].value).toBe(2);
  });
  it("test word", () => {
    const data = display(view, WORD);
    expect(parseInt(data[0].value, 16)).toBe(0x0102);
    expect(parseInt(data[1].value, 16)).toBe(0x0304);
  });
  it("test dword", () => {
    const data = display(view, DWORD);
    expect(parseInt(data[0].value, 16)).toBe(0x01020304);
  });
  it("test qword", () => {
    const data = display(view, QWORD);
    expect(parseInt(data[0].value, 16)).toBe(0x0102030405060708);
  });

  it("test float", () => {
    const data = display(fview, float);
    expect(Math.round(data[0].value)).toBe(22);
    expect(data[1].offset).toBe(4);
    expect(Math.round(data[1].value)).toBe(10);
  });
  it("test double", () => {
    const data = display(dview, double);
    expect(data[0].value).toBe(22.23456);
  });
});

describe("test pos", () => {
  let view: DataView;
  let struct: StructBuffer;
  beforeAll(() => {
    view = new DataView(new ArrayBuffer(2 * 8 * 4));

    view.setFloat64(0 * 8, 1.23);
    view.setFloat64(1 * 8, 22.66);

    view.setFloat64(2 * 8, 140.67);
    view.setFloat64(3 * 8, 742.45);

    view.setFloat64(4 * 8, 123.23);
    view.setFloat64(5 * 8, 1231.23);

    view.setFloat64(6 * 8, 534.23);
    view.setFloat64(7 * 8, 873.35);

    struct = new StructBuffer({
      pos: double[4][2],
    });
  });

  it("test decode", () => {
    const { pos } = struct.decode(view);
    expect(pos.length).toBe(4);
    expect(pos[0].length).toBe(2);
    expect(pos[1].length).toBe(2);
    expect(pos[2].length).toBe(2);
    expect(pos[3].length).toBe(2);

    expect(pos[0][0]).toBe(1.23);
    expect(pos[0][1]).toBe(22.66);

    expect(pos[3][0]).toBe(534.23);
    expect(pos[3][1]).toBe(873.35);
  });

  it("test decode", () => {
    const view = struct.encode({
      pos: [
        [1.23, 22.66],
        [140.67, 742.45],
        [123.23, 1231.23],
        [534.23, 873.35],
      ],
    });
    expect(view.getFloat64(0 * 8)).toBe(1.23);
    expect(view.getFloat64(7 * 8)).toBe(873.35);
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(2 * 8 * 4);
  });
});

describe("test names", () => {
  let view: DataView;
  let struct: StructBuffer;
  beforeAll(() => {
    view = new DataView(new ArrayBuffer(3 * 4));

    view.setUint32(0 * 4, 0x61626364);
    view.setUint32(1 * 4, 0x61626365);
    view.setUint32(2 * 4, 0x61626366);

    struct = new StructBuffer({
      names: string_t[3][4],
    });
  });

  it("test decode", () => {
    const { names } = struct.decode(view);
    expect(names.length).toBe(3);
    expect(names[0].length).toBe(4);
    expect(names[0]).toBe("abcd");
    expect(names[1]).toBe("abce");
    expect(names[2]).toBe("abcf");
  });

  it("test decode", () => {
    const view = struct.encode({
      names: ["abcd", "abce", "abcf"],
    });
    expect(view.getUint32(0 * 4)).toBe(0x61626364);
    expect(view.getUint32(1 * 4)).toBe(0x61626365);
    expect(view.getUint32(2 * 4)).toBe(0x61626366);
  });

  it("test byteLength", () => {
    expect(struct.byteLength).toBe(12);
  });
});
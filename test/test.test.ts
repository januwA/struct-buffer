import { DWORD, string_t, StructBuffer, uint32_t } from "../src";

describe("main", () => {
  let struct: StructBuffer;

  beforeAll(() => {
    struct = new StructBuffer({
      hp: DWORD,
      lp: 'asd',
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

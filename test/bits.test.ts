import { DWORD, bits, StructBuffer, WORD } from "../src";

describe("bits test", () => {
  it("decode and encode", () => {
    // zf,pf,if
    const eflag_data = 0x00000246;
    const littleEndian = true;

    const EFLAG = bits(DWORD, {
      CF: 0,
      PF: 2,
      AF: 4,
      ZF: 6,
      SF: 7,
      TF: 8,
      IF: 9,
      DF: 10,
      OF: 11,
    });
    const data = EFLAG.decode(new Uint32Array([eflag_data]), littleEndian);
    expect(data.ZF).toBe(1);
    expect(data.PF).toBe(1);
    expect(data.IF).toBe(1);

    const view = EFLAG.encode(
      {
        PF: 1,
        ZF: 1,
        IF: 1,
      },
      littleEndian
    );
    expect(view.getUint8(0)).toBe(0x44);
  });

  it("test struct", () => {
    const struct = new StructBuffer("Test", {
      id: WORD,
      eflag: bits(DWORD, {
        PF: 2,
        ZF: 6,
        TF: 8,
        IF: 9,
      }),
    });

    const data = struct.decode(new Uint8Array([0, 1, 0x00, 0x00, 0x02, 0x46]));
    expect(data.id).toBe(1);
    expect(data.eflag.ZF).toBe(1);

    // const view = struct.encode({
    //   id: 1,
    //   eflag: { PF: 1, ZF: 1, TF: 0, IF: 1 },
    // });
    // console.log(view);
  });
});

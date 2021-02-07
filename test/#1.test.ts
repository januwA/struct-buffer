import {
  string_t,
  StructBuffer,
  uchar,
  ushort,
  sbytes2 as b2,
  sview,
} from "../src";

// https://github.com/januwA/struct-buffer/issues/1

describe("debug", () => {

  // 这个测试比较消耗时间
  // it("struct", () => {
  //   const t1 = new StructBuffer("T1", {
  //     name: string_t[4][2][2][16],
  //     v1: ushort,
  //     v2: uchar[6],
  //   });

  //   const t2 = new StructBuffer("T2", {
  //     items: t1[4][18], // multi
  //   });

  //   expect(t1.byteLength).toBe(264);
  //   expect(t2.byteLength).toBe(19008);
  // });

  it("string_t", () => {
    expect(string_t[5].decode(b2("abcdefg")).length).toBe(5); // abcde

    expect(string_t[5].decode(b2("ab\\x00cdefg")).length).toBe(2); // ab

    expect(string_t[4][2].decode(b2("ab\\x00cdefg")).length).toBe(1); // [ 'ab' ]

    // Error: overflow
    // console.log(
    //   string_t[10].decode(
    //     new Uint8Array([0x61, 0x62, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68])
    //   )
    // );

    expect(sview(string_t[5].encode("abcdefghijk" as any))).toBe(
      "61 62 63 64 65"
    );
    expect(sview(string_t[5].encode("ab" as any))).toBe("61 62 00 00 00");
  });
});

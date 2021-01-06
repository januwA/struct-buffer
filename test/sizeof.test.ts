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
  FLOAT,
  DOUBLE,
} from "../src";

describe("test sizeof", () => {
  it("test byte", () => {
    expect(sizeof(BYTE)).toBe(1);
    expect(sizeof(BYTE[10])).toBe(10);
    expect(sizeof(BYTE[1][1])).toBe(1);
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
    expect(sizeof(FLOAT)).toBe(4);
    expect(sizeof(FLOAT[10])).toBe(4 * 10);
  });

  it("test double", () => {
    expect(sizeof(double)).toBe(8);
    expect(sizeof(double[10])).toBe(8 * 10);
    expect(sizeof(DOUBLE)).toBe(8);
    expect(sizeof(DOUBLE[10])).toBe(8 * 10);
  });

  it("test char", () => {
    expect(sizeof(char)).toBe(1);
    expect(sizeof(char[10])).toBe(10);
  });

  it("test string_t", () => {
    expect(sizeof(string_t)).toBe(1);
    expect(sizeof(string_t[10])).toBe(10);
  });

  it("test struct", () => {
    expect(
      sizeof(
        new StructBuffer("Test", {
          a: DWORD,
          b: BYTE,
        })
      )
    ).toBe(8);

    expect(
      sizeof(
        new StructBuffer("Test", {
          a: char[5],
          b: BYTE,
        })
      )
    ).toBe(6);

    expect(
      sizeof(
        new StructBuffer("Test", {
          a: QWORD,
          b: WORD,
          c: BYTE,
        })
      )
    ).toBe(16);

    const A = new StructBuffer("Test", {
      a: QWORD,
      b: BYTE,
    });
    const B = new StructBuffer("Test", {
      a: DWORD,
      b: A,
      c: BYTE,
    });
    expect(B.maxSize).toBe(8);
    expect(B.byteLength).toBe(14);
    expect(sizeof(B)).toBe(16);
    expect(sizeof(B[2][2][2])).toBe(128);
  });

  it("test struct Multilevel array", () => {
    const s = new StructBuffer("Test", {
      hp: DWORD,
      isJump: BYTE,
    });
    expect(sizeof(s)).toBe(8);
    expect(sizeof(s[2])).toBe(16);
    expect(sizeof(s[2][2])).toBe(32);
    expect(sizeof(s[2][2][2])).toBe(64);
  });
});

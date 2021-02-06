import { DWORD, BYTE, WORD, QWORD, float, double, display, pack } from "../src";

describe("test display", () => {
  const view: DataView = pack("8B", 1, 2, 3, 4, 5, 6, 7, 8);
  it("test byte", () => {
    const data = display(view, BYTE, { hex: false });
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
    const data = display(float[2].encode([22.2, 10.1]), float, { hex: false });
    expect(Math.round(data[0].value)).toBe(22);
    expect(data[1].offset).toBe(4);
    expect(Math.round(data[1].value)).toBe(10);
  });

  it("test double", () => {
    const data = display(double.encode(22.23456), double, {
      hex: false,
    });
    expect(data[0].value).toBe(22.23456);
  });
});

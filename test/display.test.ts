import { uint32_t, uint8_t, uint16_t, uint64_t, float, double, display, makeDataView } from "../src";

describe("test display", () => {
  const view: DataView = makeDataView([1, 2, 3, 4, 5, 6, 7, 8]);
  it("test uint8_t", () => {
    const data = display(view, uint8_t, { hex: false });
    expect(data[0].value).toBe(1);
    expect(data[1].value).toBe(2);
  });
  it("test uint16_t", () => {
    const data = display(view, uint16_t);
    expect(parseInt(data[0].value, 16)).toBe(0x0102);
    expect(parseInt(data[1].value, 16)).toBe(0x0304);
  });
  it("test uint32_t", () => {
    const data = display(view, uint32_t);
    expect(parseInt(data[0].value, 16)).toBe(0x01020304);
  });
  it("test uint64_t", () => {
    const data = display(view, uint64_t);
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

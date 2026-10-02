import { uint8_t, uint16_t, uint32_t, makeDataView } from "../src";

/**
 * 布尔语义的归属。
 *
 * 库里没有 bool / BOOL, 也没有 BoolType: 一个"布尔"字段在真实报文里是 1 / 2 / 4 字节
 * 整数, 而合法取值往往不止 {0, 1}。折成 `boolean` 会同时丢两样东西 ——
 *
 *   - 不同的字节解出同一个值: [1, 2] 都变 true, 于是 `a === b` 在两种报文字节下都成立
 *   - 编不回去: encode 只认 0 / 1, 原始的 2 永远出不来, 往返即损坏
 *
 * 所以宽度交给 `uintN_t`, 真值判断交给调用方。下面的断言就是防止有人再把折叠加回来。
 */
describe("布尔语义由调用方判断", () => {
  it("整数类型不做真值折叠, 保留原始取值", () => {
    const wire = [0, 0, 0, 1, 0, 0, 0, 2];
    const data = uint32_t[2].decode(wire);

    expect(data).toEqual([1, 2]);
    expect(data[0] === data[1]).toBe(false);

    // 真值判断是消费方的事, 各宽度都一样
    expect(data.map(Boolean)).toEqual([true, true]);
    expect(data.filter((it) => it !== 0)).toEqual([1, 2]);
  });

  it("取值能原样编回去", () => {
    const wire = [0, 0, 0, 1, 0, 0, 0, 2];
    expect(uint32_t[2].encode(uint32_t[2].decode(wire))).toEqual(
      makeDataView(wire)
    );
  });

  it("1 / 2 / 4 字节都只是整数宽度, 没有额外语义", () => {
    expect(uint8_t.decode(makeDataView([2]))).toBe(2);
    expect(uint16_t.decode(makeDataView([0, 2]))).toBe(2);
    expect(uint32_t.decode(makeDataView([0, 0, 0, 2]))).toBe(2);
  });
});
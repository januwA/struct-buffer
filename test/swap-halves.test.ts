import {
  bytes,
  hexStr,
  records,
  ref,
  sbytes,
  struct,
  sview,
  swapHalves,
  uint8_t,
  uint16_t,
} from "../src";

describe("swapHalves", () => {
  it("uint16_t 标量: 交换两半后按小端读出", () => {
    const field = swapHalves(uint16_t);

    expect(field.decode(sbytes("00 5d"), true)).toBe(93);
    expect(sview(field.encode(93, true)).toLowerCase()).toBe("00 5d");
  });

  it("hexStr(8): 只交换两半, 不叠加 littleEndian 全反转", () => {
    const field = swapHalves(hexStr(8, { prefix: "0X", upperCase: true }));

    expect(field.decode(sbytes("00 02 60 00 de 4e 3d 39"))).toBe(
      "0XDE4E3D3900026000",
    );
    expect(sview(field.encode("0XDE4E3D3900026000")).toLowerCase()).toBe(
      "00 02 60 00 de 4e 3d 39",
    );
  });

  it("hexStr(8): 只交换两半, littleEndian", () => {
    const field = swapHalves(
      hexStr(8, { prefix: "0X", upperCase: true, littleEndian: true }),
    );

    expect(field.decode(sbytes("00 02 60 00 de 4e 3d 39"))).toBe(
      "0x00600200393d4ede".toUpperCase(),
    );
    expect(sview(field.encode("0x00600200393d4ede")).toLowerCase()).toBe(
      "00 02 60 00 de 4e 3d 39",
    );
  });

  it("嵌在 struct 里与其它字段共存", () => {
    const Packet = struct(
      "Packet",
      {
        flags: uint8_t,
        raw: swapHalves(uint16_t),
        id: swapHalves(
          hexStr(8, { prefix: "0X", upperCase: true, littleEndian: false }),
        ),
      },
      { littleEndian: true },
    );

    const buf = Packet.encode({
      flags: 1,
      raw: 93,
      id: "0XDE4E3D3900026000",
    });

    expect(sview(buf).toLowerCase()).toBe("01 00 5d 00 02 60 00 de 4e 3d 39");

    const decoded = Packet.decode(buf);
    expect(decoded.flags).toBe(1);
    expect(decoded.raw).toBe(93);
    expect(decoded.id).toBe("0XDE4E3D3900026000");
  });

  it("保持定长, 可用于 records", () => {
    const items = records(swapHalves(uint16_t)).decode(
      sbytes("00 5d 00 5d"),
      true,
    );
    expect(items).toEqual([93, 93]);
  });

  it("变长内层在构造期抛错", () => {
    expect(() => swapHalves(bytes(ref("n")))).toThrow(TypeError);
  });

  it("奇数宽度内层在构造期抛错", () => {
    expect(() => swapHalves(bytes(3))).toThrow(TypeError);
  });
});

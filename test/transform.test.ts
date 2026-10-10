import {
  struct,
  transform,
  float,
  double,
  uint32_t,
  uint8_t,
  int16_t,
  list,
  sbytes,
  EncodeError,
} from "../src";

describe("transform feature", () => {
  it("float / double 保留 2 位小数 (单向 decode)", () => {
    const Sensor = struct(
      "Sensor",
      {
        temp: transform(float, (v) => Number(v.toFixed(2))),
      },
      { littleEndian: true }
    );

    // float 3.1415926 in little-endian: db 0f 49 40
    const data = Sensor.decode(sbytes("db 0f 49 40"));
    expect(data.temp).toBe(3.14);
  });

  it("毫秒与秒互转 (双向 encode & decode)", () => {
    const Device = struct(
      "Device",
      {
        id: uint32_t,
        uptimeSec: transform(uint32_t, {
          decode: (ms) => ms / 1000,
          encode: (sec) => sec * 1000,
        }),
      },
      { littleEndian: true }
    );

    // id: 1, uptime: 5000ms (0x1388)
    const encoded = Device.encode({ id: 1, uptimeSec: 5 });
    const decoded = Device.decode(encoded);

    expect(decoded.id).toBe(1);
    expect(decoded.uptimeSec).toBe(5);
  });

  it("基于上下文 ctx 字段联动计算", () => {
    const ScalePacket = struct(
      "ScalePacket",
      {
        scale: uint8_t,
        val: transform(int16_t, (raw, ctx) => raw * ctx.scale),
      },
      { littleEndian: true }
    );

    // scale = 10, val = 5 -> 5 * 10 = 50
    const decoded = ScalePacket.decode(sbytes("0a 05 00"));
    expect(decoded.scale).toBe(10);
    expect(decoded.val).toBe(50);
  });

  it("未提供 encode 时尝试编码会抛出 EncodeError", () => {
    const ReadOnlyPacket = struct("ReadOnlyPacket", {
      val: transform(uint32_t, (v) => v * 2),
    });

    expect(() => {
      ReadOnlyPacket.encode({ val: 10 });
    }).toThrow(EncodeError);
  });

  it("在 list 中使用 transform 并保持定长", () => {
    const ListPacket = struct(
      "ListPacket",
      {
        values: list(
          transform(uint8_t, {
            decode: (v) => v * 10,
            encode: (v) => v / 10,
          }),
          3
        ),
      }
    );

    const buf = ListPacket.encode({ values: [10, 20, 30] });
    expect(Array.from(new Uint8Array(buf.buffer))).toEqual([1, 2, 3]);

    const decoded = ListPacket.decode(buf);
    expect(decoded.values).toEqual([10, 20, 30]);
  });
});

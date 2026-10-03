/**
 * 长度前缀 + 非 UTF-8 文本布局的 golden test.
 *
 * 这里断言的是**字节级布局**, 而不只是"能解出个对象":
 *
 * - `body` 是 4 字节包头之后、长度恰好为 `size` 的整块
 * - 布局: uknow1:u16 | msg_type:u8 | msg_size:u16 | msg[u8 x msg_size]
 *         | name_size:u8 | name[u8 x name_size] | uknow3:u8[8]
 * - 全程 little-endian
 * - 正文是 **GBK**, 所以按字节拿(`uint8_t[n]`)再自己 GBK 解码 —— 库里
 *   没有字符串类型, 按 UTF-8 解必然乱码
 *
 * 数据是合成的(见 fixtures/len-prefixed.ts), 覆盖长度前缀、自引用长度、
 * 定长尾巴与 GBK 双字节文本。
 */
import { DynamicStructBuffer, ref, uint16_t, uint8_t } from "../src";
import { LEN_PREFIXED } from "./fixtures/len-prefixed";

const MessageStruct = new DynamicStructBuffer(
  "msg",
  {
    uknow1: uint16_t,
    msg_type: uint8_t, // 1 玩家消息, 2 系统消息, ...
    msg_size: uint16_t,
    msg: uint8_t[ref("msg_size")],
    name_size: uint8_t,
    name: uint8_t[ref("name_size")],
    uknow3: uint8_t[8],
  },
  { littleEndian: true }
);

const gbk = new TextDecoder("gbk");
const bytesOf = (hex: string) =>
  Uint8Array.from(hex.split(" "), (h) => parseInt(h, 16));
const hexOf = (dv: DataView) =>
  Array.from({ length: dv.byteLength }, (_, i) =>
    dv.getUint8(i).toString(16).padStart(2, "0")
  ).join(" ");

const RECORDS = LEN_PREFIXED;

describe("golden: 长度前缀 + GBK 文本布局", () => {
  it("fixture 本身是 8 条", () => {
    expect(RECORDS).toHaveLength(8);
  });

  it.each(RECORDS.map((r, i) => [i, r] as const))(
    "第 %i 号报文往返一致",
    (_i, rec) => {
      const wire = bytesOf(rec.body);
      expect(wire).toHaveLength(rec.size);

      const d = MessageStruct.decode(wire);
      expect(d.msg_type).toBe(rec.msg_type);
      expect(d.msg_size).toBe(rec.msg_size);
      expect(d.name_size).toBe(rec.name_size);
      // 长度字段与实际字节数必须自洽, 否则长度前缀本身就是错的
      expect(d.msg).toHaveLength(rec.msg_size);
      expect(d.name).toHaveLength(rec.name_size);
      // 布局: 全部字段加起来的字节数必须正好等于整块长度, 一个字节都不能多也不能少
      expect(d.uknow3).toHaveLength(8);
      expect(5 + rec.msg_size + 1 + rec.name_size + 8).toBe(rec.size);

      expect(gbk.decode(Uint8Array.from(d.msg))).toBe(rec.msg);
      expect(gbk.decode(Uint8Array.from(d.name))).toBe(rec.name);

      // 最强断言: 重新编码得到逐字节相同的帧
      const re = MessageStruct.encode(d);
      expect(re.byteLength).toBe(rec.size);
      expect(hexOf(re)).toBe(rec.body);
    }
  );

  it("布局的每一条记录都与上报字段自洽", () => {
    for (const rec of RECORDS) {
      expect(5 + rec.msg_size + 1 + rec.name_size + 8).toBe(rec.size);
    }
    // 覆盖多种 msg_type, 别只测一种; 同时要含空 msg / 空 name 的边界
    expect(new Set(RECORDS.map((r) => r.msg_type))).toEqual(new Set([0, 1, 2, 4, 7, 255]));
    expect(RECORDS.some((r) => r.msg_size === 0)).toBe(true);
    expect(RECORDS.some((r) => r.name_size === 0)).toBe(true);
  });

  it("正文里的 NUL 不截断(库只给字节, 不当 C 字符串)", () => {
    const rec = RECORDS.find((r) => r.msg.includes("\0"))!;
    const d = MessageStruct.decode(bytesOf(rec.body));
    expect(d.msg).toHaveLength(rec.msg_size);
    expect(gbk.decode(Uint8Array.from(d.msg))).toBe(rec.msg);
    // 对比: 定宽字段也不截 NUL 了 —— 截断归调用点, 库一律给满宽度
    expect(gbk.decode(Uint8Array.from(d.msg)).split("\0")).toHaveLength(3);
  });

  it("长度字段缺失时自动回填, 且回填值是字节数", () => {
    const rec = RECORDS.find((r) => r.msg_size > 0 && r.name_size > 0)!;
    const d: any = MessageStruct.decode(bytesOf(rec.body));
    delete d.msg_size;
    delete d.name_size;
    const re = MessageStruct.encode(d);
    expect(re.byteLength).toBe(rec.size);
    expect(hexOf(re)).toBe(rec.body);
  });

  it("encode 不改调用方对象", () => {
    const d: any = MessageStruct.decode(bytesOf(RECORDS[0].body));
    d.msg_size = undefined;
    d.name_size = undefined;
    const before = JSON.stringify(d);
    MessageStruct.encode(d);
    expect(JSON.stringify(d)).toBe(before);
  });

  it("正文是 GBK, 按 UTF-8 解会乱码(说明为何只拿字节)", () => {
    // 得挑 GBK 与 UTF-8 解码结果不同的样本: 纯 ASCII 两者本来就一样
    const rec = RECORDS.find(
      (r) =>
        new TextDecoder("utf-8").decode(
          Uint8Array.from(r.body.split(" "), (h) => parseInt(h, 16)).subarray(
            6 + r.msg_size,
            6 + r.msg_size + r.name_size
          )
        ) !== r.name
    )!;
    expect(rec).toBeDefined();
    const d = MessageStruct.decode(bytesOf(rec.body));
    const nameBytes = Uint8Array.from(d.name);
    expect(gbk.decode(nameBytes)).toBe(rec.name);
    // 同一串字节按 UTF-8 解必然解出别的东西(或直接乱码)
    expect(new TextDecoder("utf-8").decode(nameBytes)).not.toBe(rec.name);
  });
});
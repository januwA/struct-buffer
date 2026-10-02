import {
  blob,
  createDataView,
  DynamicStructBuffer,
  makeDataView,
  ref,
  uint16_t,
  uint32_t,
  uint8_t,
} from "../src";

describe("DynamicStructBuffer", () => {
  it("user message packet: decode and encode", () => {
    const MessageStruct = new DynamicStructBuffer("msg", {
      size: uint16_t,
      uknow1: uint8_t,
      uknow2: uint16_t,
      msg_size: uint16_t,
      msg: uint8_t[ref("msg_size")],
    });

    const payload = [0x11, 0x22, 0x33, 0x44];
    const encoded = MessageStruct.encode({
      size: 100,
      uknow1: 1,
      uknow2: 2,
      msg_size: payload.length,
      msg: payload,
    });

    // 2 (size) + 1 (uknow1) + 2 (uknow2) + 2 (msg_size) + 4 (msg) = 11 bytes
    expect(encoded.byteLength).toBe(11);

    const decoded = MessageStruct.decode(encoded);
    expect(decoded).toEqual({
      size: 100,
      uknow1: 1,
      uknow2: 2,
      msg_size: 4,
      msg: [0x11, 0x22, 0x33, 0x44],
    });
  });

  it("auto-fill ref field length during encode", () => {
    const MessageStruct = new DynamicStructBuffer("msg", {
      size: uint16_t,
      uknow1: uint8_t,
      uknow2: uint16_t,
      msg_size: uint16_t,
      msg: uint8_t[ref("msg_size")],
    });

    // Omit msg_size; it should be auto-derived from msg.length
    const encoded = MessageStruct.encode({
      size: 50,
      uknow1: 9,
      uknow2: 8,
      msg: [0xaa, 0xbb, 0xcc],
    } as any);

    expect(encoded.byteLength).toBe(10);

    const decoded = MessageStruct.decode(encoded);
    expect(decoded.msg_size).toBe(3);
    expect(decoded.msg).toEqual([0xaa, 0xbb, 0xcc]);
  });

  it("dynamic text field with ref: 长度按字节数回填, 编码归调用方", () => {
    const ChatPacket = new DynamicStructBuffer("chat", {
      channel: uint8_t,
      text_len: uint16_t,
      text: blob(ref("text_len")),
    });

    const encoded = ChatPacket.encode({
      channel: 1,
      text: "hello world",
    });

    // 1 (channel) + 2 (text_len) + 11 (text) = 14 bytes
    expect(encoded.byteLength).toBe(14);

    const decoded = ChatPacket.decode(encoded);
    expect(decoded.channel).toBe(1);
    expect(decoded.text_len).toBe(11);
    // 长度头写的是**字节数**: "世界" 的 length 是 2, UTF-8 占 6 字节 —— 拿字符数当
    // 长度会把正文截掉
    expect(new TextDecoder().decode(decoded.text)).toBe("hello world");
  });

  it("dynamic array of nested struct", () => {
    const Item = new DynamicStructBuffer("item", {
      id: uint32_t,
      count: uint16_t,
    });

    const Bag = new DynamicStructBuffer("bag", {
      item_count: uint8_t,
      items: Item[ref("item_count")],
    });

    const encoded = Bag.encode({
      item_count: 2,
      items: [
        { id: 1001, count: 5 },
        { id: 2002, count: 10 },
      ],
    });

    // 1 + 2 * (4 + 2) = 13 bytes
    expect(encoded.byteLength).toBe(13);

    const decoded = Bag.decode(encoded);
    expect(decoded.item_count).toBe(2);
    expect(decoded.items).toEqual([
      { id: 1001, count: 5 },
      { id: 2002, count: 10 },
    ]);
  });

  it("ref with transform function", () => {
    // Length header represents byte length + 2
    const Transformed = new DynamicStructBuffer("tf", {
      hdr_len: uint16_t,
      data: uint8_t[ref("hdr_len", (v) => v - 2)],
    });

    const encoded = Transformed.encode({
      hdr_len: 5, // 3 bytes payload + 2
      data: [1, 2, 3],
    });

    expect(encoded.byteLength).toBe(5);

    const decoded = Transformed.decode(encoded);
    expect(decoded.hdr_len).toBe(5);
    expect(decoded.data).toEqual([1, 2, 3]);
  });
});

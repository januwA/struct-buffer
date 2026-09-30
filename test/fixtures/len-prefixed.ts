/**
 * 变长尾字段协议(合成数据)的测试向量.
 *
 * 这个布局挑的是"长度前缀 + 非 UTF-8 文本"这一类最容易解错的结构:
 *
 * `uknow1:u16 | msg_type:u8 | msg_size:u16 | msg[u8 x msg_size] |
 *  name_size:u8 | name[u8 x name_size] | uknow3:u8[8]`, 全程 little-endian.
 *
 * 值得注意的点:
 *
 * - 整块长度恰好等于 `size`, 于是"各字段字节数之和 == 整块长度"是可断言的 ——
 *   这比"能解出个对象"强得多: 布局错一个字节就会红.
 * - `body` 是 4 字节包头之后的那一整块, 也就是长度自洽的唯一可信来源.
 * - 文本是 **GBK**, 所以用 `uint8_t` 拿原始字节再自己 GBK 解码; 用 `string_t`
 *   会走 UTF-8, 中文必然解错. 样本里特意放了 GBK 与 UTF-8 解码结果不同的内容,
 *   也有两者相同的纯 ASCII 内容.
 *
 * 覆盖到的字节级坑:
 *
 * - **GBK 双字节**: 中文字符占 2 字节, 长度字段记的是字节数而非字符数.
 * - **NUL 混在正文里**: 变长 blob 不像定宽字符串那样在 NUL 处截断, 所以
 *   `"has\0nul\0inside"` 必须原样解出 14 字节.
 * - **长度前缀自洽**: `msg_size` / `name_size` 必须等于实际字节数.
 * - **边界**: 空 msg、空 name、`msg_type` 为 0 与 255。
 *
 * 数据是**合成**的(用 iconv-lite 按 GBK 编码拼出来的), 不含任何真实抓包内容。
 * 本文件只固定住几个必须过的样本 —— 更大规模的随机用例应当现生成, 别把随机
 * 数据当 golden。
 */
export interface LenPrefixedFrame {
  /** body 字节数 */
  size: number;
  msg_type: number;
  /** msg 段的字节数 */
  msg_size: number;
  /** msg 段按 GBK 解码 */
  msg: string;
  /** name 段的字节数 */
  name_size: number;
  /** name 段按 GBK 解码 */
  name: string;
  /** 空格分隔的小写 hex */
  body: string;
}

export const LEN_PREFIXED: LenPrefixedFrame[] = [
  {
    size: 25,
    msg_type: 1,
    msg_size: 5,
    msg: "hello",
    name_size: 6,
    name: "player",
    body: "34 12 01 05 00 68 65 6c 6c 6f 06 70 6c 61 79 65 72 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 28,
    msg_type: 1,
    msg_size: 10,
    msg: "你好，世界",
    name_size: 4,
    name: "张三",
    body: "34 12 01 0a 00 c4 e3 ba c3 a3 ac ca c0 bd e7 04 d5 c5 c8 fd 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 24,
    msg_type: 2,
    msg_size: 8,
    msg: "系统消息",
    name_size: 2,
    name: "gm",
    body: "34 12 02 08 00 cf b5 cd b3 cf fb cf a2 02 67 6d 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 15,
    msg_type: 2,
    msg_size: 0,
    msg: "",
    name_size: 1,
    name: "a",
    body: "34 12 02 00 00 01 61 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 41,
    msg_type: 4,
    msg_size: 23,
    msg: "mixed ascii + 中文 tail",
    name_size: 4,
    name: "éè",
    body: "34 12 04 17 00 6d 69 78 65 64 20 61 73 63 69 69 20 2b 20 d6 d0 ce c4 20 74 61 69 6c 04 a8 a6 a8 a8 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 39,
    msg_type: 7,
    msg_size: 14,
    msg: "has\u0000nul\u0000inside",
    name_size: 11,
    name: "nul\u0000in-name",
    body: "34 12 07 0e 00 68 61 73 00 6e 75 6c 00 69 6e 73 69 64 65 0b 6e 75 6c 00 69 6e 2d 6e 61 6d 65 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 33,
    msg_type: 255,
    msg_size: 15,
    msg: "繁体字 max type",
    name_size: 4,
    name: "漢字",
    body: "34 12 ff 0f 00 b7 b1 cc e5 d7 d6 20 6d 61 78 20 74 79 70 65 04 9d 68 d7 d6 5a 5a 5a 5a 5a 5a 5a 5a",
  },
  {
    size: 35,
    msg_type: 0,
    msg_size: 21,
    msg: "zero type, empty name",
    name_size: 0,
    name: "",
    body: "34 12 00 15 00 7a 65 72 6f 20 74 79 70 65 2c 20 65 6d 70 74 79 20 6e 61 6d 65 00 5a 5a 5a 5a 5a 5a 5a 5a",
  },
];

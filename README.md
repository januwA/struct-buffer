## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { bytes, struct, uint32_t, uint8_t, sbytes } from "struct-buffer";

const Player = struct("Player", {
  hp: uint32_t,
  mp: uint32_t,
  name: bytes(3),
});

const view: DataView = sbytes("41 20 00 00 42 c8 00 00 61 62 63");

// decode
const data = Player.decode(view);
// data => { hp: 10, mp: 100, name: Uint8Array [0x61, 0x62, 0x63] }

// encode
const out = Player.encode({
  hp: 10,
  mp: 100,
  name: new Uint8Array([0x61, 0x62, 0x63]),
});
// out => <41 20 00 00 42 c8 00 00 61 62 63>
```

`struct(...)` 返回一个 codec: 它自己带 `decode` / `decodeLenient` / `encode`, 也能直接嵌进
别的结构体当字段。整个库只有一套 AST 和一台引擎 —— schema 就是那棵 AST。

## Use in browser
```html
<script src="struct-buffer.js"></script>
<script>
  const { struct, bytes, uint32_t } = window.StructBuffer;
</script>
```

## 标量类型

类型就是线上的字节形状 `(size, unsigned, kind)`, 没有名字 —— 同宽同符号的 C 别名本来就是同一个
类型, 多导一份只会让人在"该用哪个"上纠结, 而名字对编解码又毫无用处:

| 有符号 | 无符号 | C / Windows 里的对应写法 |
| --- | --- | --- |
| `int8_t` | `uint8_t` | `signed char` / `unsigned char`、`BYTE` |
| `int16_t` | `uint16_t` | `short`、`WORD` |
| `int32_t` | `uint32_t` | `int`、`DWORD` |
| `int64_t` | `uint64_t` | `long long`、`QWORD` |
| `float` | `double` | 4 / 8 字节浮点 |

表里的 C 写法只是说明这些类型对应协议里的哪个字段, 不作为标识符存在 —— 用 `uint32_t` 而不是
`DWORD`。宽度或浮点身份不合适就 [`registerType`](#register-type)。

两处语义在 6.0 修正，升级时留意：

- `int64_t` 之前走的是无符号的 `getBigUint64`，负数解出来是一大坨正数。现在按有符号解。
- 8 字节类型的**值类型统一是 `number`**，不再把 `bigint` 抛给调用方。代价是超过
  `2^53` 的值会掉精度（协议里的 64 位计数/时间戳基本够用，文件偏移请自己确认）。

## register Type
类型就是线上的字节形状 `(size, unsigned, kind)`, 没有名字:

```ts
import { registerType, struct } from "struct-buffer";

const myShort = registerType(2, false);
const myFloat = registerType(4, true, "float"); // kind 默认 "int"

const Player = struct("Player", {
  hp: myShort,
  mp: myShort,
  pos: list(myShort, 2),
});

const data = Player.decode(sbytes("00 02 00 0a 00 64 00 c8"));
// data => { hp: 2, mp: 10, pos: [ 100, 200 ] }
```

`kind` 决定整数还是浮点, 历史上这里靠"名字里有没有 float"猜 —— 代价是任何 float 别名都会
掉队: `size=4` + `unsigned=true` 只能落到 `getUint32`, 于是 `1.5` 被静默编成 `00 00 00 01`,
不报错、字节还合法。名字是给人看的, 不该参与派发, 所以浮点身份必须显式声明。

## Nested struct
```ts
/*
typedef struct _XINPUT_STATE {
  DWORD          dwPacketNumber;
  XINPUT_GAMEPAD Gamepad;
} XINPUT_STATE, *PXINPUT_STATE;
*/

import { int16_t, struct, uint16_t, uint32_t, uint8_t } from "struct-buffer";

const XINPUT_GAMEPAD = struct("XINPUT_GAMEPAD", {
  wButtons: uint16_t,
  bLeftTrigger: uint8_t,
  bRightTrigger: uint8_t,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

const XINPUT_STATE = struct("XINPUT_STATE", {
  dwPacketNumber: uint32_t,
  Gamepad: XINPUT_GAMEPAD,
});

// decode
XINPUT_STATE.decode(
  new Uint8Array([
    0, 0, 0, 0, // dwPacketNumber
    0, 1,       // wButtons
    0,          // bLeftTrigger
    0,          // bRightTrigger
    0, 1,       // sThumbLX
    0, 2,       // sThumbLY
    0, 3,       // sThumbRX
    0, 4,       // sThumbRY
  ])
);

// encode
XINPUT_STATE.encode({
  dwPacketNumber: 0,
  Gamepad: {
    wButtons: 1,
    bLeftTrigger: 0,
    bRightTrigger: 0,
    sThumbLX: 1,
    sThumbLY: 2,
    sThumbRX: 3,
    sThumbRY: 4,
  },
});
```

## struct list
```ts
import { bytes, list, struct } from "struct-buffer";

const User = struct("User", {
  name: bytes(2),
  name2: bytes(2),
});

const Users = struct("Users", {
  users: list(User, 2),
});

const data = Users.decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// data.users.length => 2
// data.users[0] => { name: Uint8Array([0x61, 0x31]), name2: Uint8Array([0x61, 0x32]) }
// data.users[1] => { name: Uint8Array([0x62, 0x31]), name2: Uint8Array([0x62, 0x32]) }

// or
const users = list(User, 2).decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
```

## 变长报文

`struct` 是给带长度前缀的变长报文用的: 字段按声明顺序消费一段游标, 长度可来自前面任意字段,
嵌套结构体可递归, `ref()` 在 encode 时把实际长度回填回长度字段。

```ts
import { bytes, ref, struct, uint16_t, uint8_t } from "struct-buffer";

const Msg = struct(
  "msg",
  {
    type: uint8_t,
    len: uint16_t, // 后面 payload 的字节数
    payload: bytes(ref("len")),
    name: bytes(8),
  },
  { littleEndian: true }
);

Msg.decode(view);
// => { type: 1, len: 2, payload: Uint8Array, name: Uint8Array }

Msg.encode({
  type: 1,
  payload: new Uint8Array([0x41, 0x42]),
  name: new Uint8Array([0x61, 0x62, 0x63]),
});
// len 不用给: encode 会把 payload 实际字节数回填进 len, 而且**不改你的入参对象**
```

`littleEndian` 省略则逐级继承父级, 最近的显式配置赢; 不给就是大端。

decode 结果和 encode 入参的类型都是推出来的, 不用手写(见下面的[类型推导](#类型推导))。

### 嵌套列表

`list` 就是数组, 维度靠嵌套, 不再有 `T[n]` 下标魔法:

```ts
import { list, ref, struct, uint32_t, uint8_t } from "struct-buffer";

const Item = struct("item", { id: uint32_t });
const Grid = struct("grid", {
  n: uint8_t,
  rows: list(Item, ref("n")),   // 由 n 决定个数
  pairs: list(list(Item, 2), 2), // 固定 2 x 2
});
Grid.decode(view);
// => { n: 2, rows: [{ id }, { id }], pairs: [[{ id }, { id }], [{ id }, { id }]] }
```

> 某维长度为 1 也不塌成单值: `list(Item, 1)` 解成数组, 与 `bytes(1)` 的"恒为字节"一致。

### 变长字段工厂

```ts
import { bytes, list, records, ref, rest, struct, uint16_t, uint8_t } from "struct-buffer";

struct("pkt", {
  len: uint16_t,
  payload: bytes(ref("len")), // Uint8Array
  tail: rest(),               // 吃掉剩下的全部字节
});

const Item = struct("item", { id: uint32_t });

struct("pkt2", {
  n: uint8_t,
  items: records(Item, ref("n")), // 个数来自 n; decode 恒为数组
});
```

- `bytes(n)` / `bytes(ref(...))` / `rest()`: 一段字节, 解成 `Uint8Array`
- `list(item, n)`: 定长或 `ref` 长度的数组; 嵌套即多维
- `records(Sub, spec?)`: 定长记录填到末尾; 变长子结构体须给 `spec`(`n` / `ref("count")`)。
  decode 恒为数组
- `skip(n)`: 占位 n 字节, 该键不出现在结果里(encode 写 0)
- `variant(key, cases)`: 变体联合, 判别字段须在本字段之前, 分支字段与其平级(平铺进父对象);
  无对应分支时 decode 抛 `DecodeError`、encode 抛 `EncodeError`
- `codec(spec)` / `delimited(spec)` / `framed(spec)`: 自定界字段, 见下

`bytes(n)` 是**定宽**字节字段(`char name[8]` 那种): encode 写满 n 字节(短补 NUL / 长截断),
decode 一律给满 n 字节, **不在 NUL 处截断** —— 截断是 C 风格字符串的约定而不是字节属性, 定宽
字段也常见空格补位或满宽正文, 猜错就是静默丢数据。要截自己切, NUL 是单字节且不会出现在多字节
序列中间, 所以切在它上面不会劈开 UTF-8 / GBK:

```ts
const cut = (b: Uint8Array) => {
  const nul = b.indexOf(0);
  return new TextDecoder("gbk").decode(nul < 0 ? b : b.subarray(0, nul));
};
```

### 宽松解码

抓包时"一帧里有个字段坏了"是常态, 整帧丢掉等于没抓到。`decodeLenient` 把坏字段变成
`undefined` 并把原因收集起来:

```ts
const { value, errors, consumed } = Msg.decodeLenient(view);
```

恢复策略(失败字段的半截推进先回滚, 再看还能不能继续):

- **定长字段**失败、且剩余字节仍够它的宽度 ⇒ 跳过继续 —— 位置仍然可信
- **变长字段**(`ref` / `rest` / `framed` / `variant`)失败 ⇒ 就地停止: 长度被带偏之后
  后面是什么已经无从判断
- 剩余字节根本不够 ⇒ 同样停止

```ts
// len 被带偏
const { value, errors, consumed } = Msg.decodeLenient(Uint8Array.from([1, 0xff, 0xff]));
// value    => { type: 1, len: 65535, payload: undefined }
// errors   => [DecodeError: msg.payload @3 需要 65535B, 只剩 0B]
// consumed => 3   ← 正好停在"从哪开始不可信"
```

只有 `DecodeError` 会被吞掉, 自定义 codec 抛的其它异常照样往外炸。

## 类型推导

`decode()` 的结果类型、`encode()` 的入参类型都由字段表推出来, 不用手写:

```ts
const Msg = struct("msg", {
  msg_type: uint8_t,
  msg: bytes(ref("msg_size")),
  name: bytes(ref("name_size")),
});

const data = Msg.decode(view);
data.msg; // Uint8Array
data.no_such_field; // 编译期报错
Msg.encode({ msg_typo: 1 }); // 编译期报错
```

几个容易踩的点:

- **encode 入参是 Partial, 且长度字段不用给** —— encode 时由框架回填
- **`bytes(...)` / `rest()` 解出来是 `Uint8Array`, 写回去也只收 `Uint8Array`** ——
  字节只有一种形态; 传字符串 / `number[]` 编译期就报错(见"文本与编码")
- **variant 分支字段在父对象上**(`data.name`, 不是 `data.body.name`), 类型上是可选的;
  不做按判别值收窄的 union

单独用 `InferDef<typeof Msg.struct>` / `InferType<typeof Msg>` / `InferEncodeDef<typeof Msg.struct>`
也能拿到类型.

## 文本与编码

库里**没有字符串类型**, 而且这一层**完全不知道字节是不是文本**。这不是遗漏, 是刻意的:
线上的字节形状才是类型, 而"这些字节是什么字符"是协议属性。真实报文的编码有 UTF-8 /
UTF-16LE / UTF-16BE / GBK / GB18030 / Big5 / Shift-JIS / codepage..., 把其中一种当默认
就是在替协议做决定。

所以 `bytes(n)` / `rest()` 的 encode 入参只有 `Uint8Array`: 传字符串或 `number[]` 编译期就报错,
绕过类型运行时也报错。`encode({ name: "hello" })` 不会"帮你按 UTF-8 转一下" —— 那等于
悄悄替你选了编码, 而选了之后 GBK / UTF-16LE 的报文就静默错了。

本库一行编解码都没实现 —— `TextDecoder` / `TextEncoder` 全程委托平台, 所以
"库里支持哪种编码"这个问题不成立: 解码用平台 `TextDecoder` 就能吃下几十种 label。

```ts
const Msg = struct("msg", {
  name_size: uint8_t,
  name: bytes(ref("name_size")), // 出 Uint8Array, 长度是字节数
});

// 解码: 编码由你指定
const gbk = new TextDecoder("gbk");
gbk.decode(Msg.decode(view).name); // => "你好，世界"

// 编码: Node 的 TextEncoder 按规范只支持 UTF-8, 别的编码得靠 iconv-lite 之类
Msg.encode({ name: gbkBytes("你好，世界") }); // 自己编码好的 Uint8Array
Msg.encode({ name: new TextEncoder().encode("hello") });

// 传字符串不行 —— 编译期就报错:
// @ts-expect-error
Msg.encode({ name: "hello" });
```

长度头一律写**字节数**: `"世界"` 的 `.length` 是 2, UTF-8 占 6 字节, GBK 占 4 字节 ——
拿字符数当长度会把正文截掉。`bytes(ref(...))` 会在 encode 时按实际字节数回填 `ref` 长度字段。

## bits
```ts
import { bits, uint32_t } from "struct-buffer";

const EFLAG_DATA = 0x00000246;
const littleEndian = true;
const EFLAG = bits(uint32_t, {
  CF: 0,
  PF: 2,
  AF: 4,
  ZF: 6,
  SF: 7,
  TF: 8,
  IF: 9,
  DF: 10,
  OF: 11,
});

// decode
const data = EFLAG.decode(new Uint32Array([EFLAG_DATA]), littleEndian);
// => { CF: 0, PF: 1, AF: 0, ZF: 1, SF: 0, TF: 0, IF: 1, DF: 0, OF: 0 }

// encode
const out = EFLAG.encode({ PF: 1, ZF: 1, IF: 1 }, littleEndian);
// => <44 02 00 00>
```

> 位名对应**一个位号**, 取值只能是 0/1; 存储支持 1/2/4 字节, 越界或非 0/1 直接报错。

## bitFields
```ts
import { bitFields, sbytes as b, uint8_t } from "struct-buffer";

const bf = bitFields(uint8_t, {
  a: 1,
  b: 2,
  c: 3,
});

const v = bf.encode({ a: 1, b: 2, c: 3 });
// => <1D>

const data = bf.decode(b("1D"));
// => { a: 1, b: 2, c: 3 }
```

> 每个字段占**连续几位**(位宽), 值须放得进该位宽; 存储支持 1/2/4 字节, 位宽总和不能超。

## delimited / framed / codec

自定界字段: 尺寸由 reader 自己推进 `Cursor` 决定 —— 引擎不需要提前知道, 所以 NUL 结尾的
C 字符串这类"长度只能跑起来才知道"的字段在这里是自然的。

```ts
import { codec, delimited, DecodeError, float, struct } from "struct-buffer";

const cstr = () =>
  delimited<string>({
    read: (c) => {
      const at = c.pos;
      while (c.left > 0) {
        if (c.view.getUint8(c.pos++) === 0) {
          // 已经扫过整段正文, 直接从 view 取: bytes() 只能从当前位置读,
          // 而游标此刻已经停在结尾 NUL 之后了
          const n = c.pos - at - 1;
          const view = new Uint8Array(c.view.buffer, c.view.byteOffset + at, n);
          return new TextDecoder().decode(view);
        }
      }
      throw DecodeError.reason(c.where, at, "没遇到结尾 NUL");
    },
    write: (w, v) => {
      w.bytes(new TextEncoder().encode(v));
      w.u8(0);
    },
  });

// 变长字段夹在定长字段中间
const Player = struct("Player", {
  hp: float,
  name: cstr(),
  mp: float,
});
```

三个工厂只差**读几个子帧**:

| | `framed` | `delimited` | `codec` |
| --- | --- | --- | --- |
| 解出来是 | `T[]` | `T` | `T` |
| 读几个 | 直到字节耗尽 / reader 返回 `null` | 一个 | 一个字段(由 reader 决定推进多少) |
| 能放中间吗 | **不能** | 能 | 能 |
| reader 返回 `null` | 流结束(干净收手) | 这一帧不完整 ⇒ `DecodeError` | 同 `delimited` |

`framed` 贪婪读到缓冲区末尾, 所以**只能放在结构体最后一个字段**; 变长字段夹在中间时它会把
后面字段的字节也当成下一个子帧吃掉(而且失败时已经吃掉了, 后面字段直接报越界)。`delimited`
读一个就停。

```ts
import { framed, struct, uint8_t } from "struct-buffer";

struct("stream", {
  ops: framed({
    read: (c) => {
      if (c.left < 2) return null; // 不够一个头 ⇒ 流结束
      const op = c.u8("op");
      const n = c.u8("flen");
      return { op, body: c.bytes(n, "body") };
    },
    write: (w, v) => {
      w.u8(v.op);
      w.u8(v.body.length);
      w.bytes(v.body);
    },
  }),
});
```

`framed` 会检查"reader 有没有推进游标": 一个子帧消费 0 字节会让循环死转, 于是直接报错。
`delimited` / `codec` 是单次读, 没有循环, 消费 0 字节是合法的。

## Some utility functions
```ts
import { createDataView, makeDataView, sbytes as b, sbytes2 as b2, sview, TEXT } from "struct-buffer";

createDataView(3)
// => <00 00 00>

makeDataView([1, 2, 3])
// => <01 02 03>

b("01 02 03")
// => <01 02 03>

b2("abc\\x1\\x2\\x3")
// => <61 62 63 01 02 03>

TEXT(makeDataView([
  0x61, 0x62, 0x63, 0x01, 0x02, 0x78, 0x79, 0x7a, 0, 0, 0, 8, 0, 0, 0, 9,
]))
// => "abc..xyz........"
```

`makeDataView` 尊重 `Uint8Array` 的 `byteOffset` / `byteLength` 窗口(subarray 不会读出去)。

## test
> $ npm test

## build
> $ npm run build

## See also:
  - [See the test for more examples](https://github.com/januwA/struct-buffer/blob/main/test/basic.test.ts)
  - [DataView](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/DataView)
  - [C_data_types](https://en.wikipedia.org/wiki/C_data_types)
  - [Built-in types (C++)](https://docs.microsoft.com/en-us/cpp/cpp/fundamental-types-cpp?view=msvc-160)
  - [C++ Bit Fields](https://docs.microsoft.com/en-us/cpp/cpp/cpp-bit-fields?view=msvc-160)

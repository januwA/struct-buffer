## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { uint32_t, uint8_t, DynamicStructBuffer, sbytes } from "struct-buffer";

const struct = new DynamicStructBuffer("Player", {
  hp: uint32_t,
  mp: uint32_t,
  name: uint8_t[3],
});

const buffer: DataView = sbytes("41 20 00 00 42 c8 00 00 61 62 63");

// decode
const data = struct.decode(buffer);
// data => { hp: 10, mp: 100, name: Uint8Array [0x61, 0x62, 0x63] }

// encode
const view = struct.encode({
  hp: 10,
  mp: 100,
  name: new Uint8Array([0x61, 0x62, 0x63]),
});
// view => <41 20 00 00 42 c8 00 00 61 62 63>
```

## Use in browser
```html
<script src="struct-buffer.js"></script>
<script>
  const { uint32_t, uint8_t, DynamicStructBuffer } = window.StructBuffer;
</script>
```

## Use ["type"](https://github.com/januwA/struct-buffer/blob/main/src/types.ts) for conversion

```ts
import { uint32_t } from "struct-buffer";

// encode
const view = uint32_t[2].encode([1, 2]); 
// view => <00 00 00 01 00 00 00 02>

// decode
const data = uint32_t[2].decode(view);
// data => [ 1, 2 ]
```

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

布尔字段在真实报文里是 1 / 2 / 4 字节整数，而合法取值往往不止 `{0, 1}`，所以库里**没有**
`bool` / `BOOL`，也不做真值折叠：宽度用 `uint8_t` / `uint16_t` / `uint32_t`，真值判断自己写。

```ts
const M = new DynamicStructBuffer("M", { ok: uint32_t });

const d = M.decode(sbytes("00 00 00 02"));
d.ok;          // => 2   原始取值，不会被折成 true
Boolean(d.ok); // => true 真值判断是消费方的事
```

折成 `boolean` 会同时丢两样东西：不同的字节解出同一个值（`[1, 2]` 都变 `true`，于是
`a === b` 在两种报文字节下都成立），以及编不回去（`encode` 只认 `0` / `1`，原始的 `2`
永远出不来，往返即损坏）。需要状态多于两态的字段，同理直接用整数类型自己收窄。

## register Type
类型就是线上的字节形状 `(size, unsigned, kind)`, 没有名字:

```ts
const myShort = registerType(2, false);
const myFloat = registerType(4, true, "float"); // kind 默认 "int"

const struct = new DynamicStructBuffer("Player", {
  hp: myShort,
  mp: myShort,
  pos: myShort[2],
});

// encode
const view = struct.encode({
  hp: 2,
  mp: 10,
  pos: [100, 200],
});
// view => <00 02 00 0a 00 64 00 c8>

// decode
const data = struct.decode(view);
// data => { hp: 2, mp: 10, pos: [ 100, 200 ] }
```

C / C++ / Windows 的别名(`BYTE`、`DWORD`、`long long`...)一个都不导出 —— 它们对
编解码没有任何影响。想表达"C 里的那个 DWORD", 直接写 `uint32_t`。

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


typedef struct _XINPUT_GAMEPAD {
  WORD  wButtons;
  BYTE  bLeftTrigger;
  BYTE  bRightTrigger;
  SHORT sThumbLX;
  SHORT sThumbLY;
  SHORT sThumbRX;
  SHORT sThumbRY;
} XINPUT_GAMEPAD, *PXINPUT_GAMEPAD;
*/

XINPUT_GAMEPAD = new DynamicStructBuffer("XINPUT_GAMEPAD", {
  wButtons: uint16_t,
  bLeftTrigger: uint8_t,
  bRightTrigger: uint8_t,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

XINPUT_STATE = new DynamicStructBuffer("XINPUT_STATE", {
  dwPacketNumber: uint32_t,
  Gamepad: XINPUT_GAMEPAD,
});

// decode
XINPUT_STATE.decode(
    new Uint8Array([
      0, 0, 0, 0, // dwPacketNumber
      0, 1, // wButtons
      0,    // bLeftTrigger
      0,    // bRightTrigger
      0, 1, // sThumbLX
      0, 2, // sThumbLY
      0, 3, // sThumbRX
      0, 4, // sThumbRY
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
const User = new DynamicStructBuffer("User", {
  name: uint8_t[2],
  name2: uint8_t[2],
});

const Users = new DynamicStructBuffer("Users", {
  users: User[2],
});

const data = Users.decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// data.users.length => 2
// data.users[0] => { name: Uint8Array([0x61, 0x31]), name2: Uint8Array([0x61, 0x32]) }
// data.users[1] => { name: Uint8Array([0x62, 0x31]), name2: Uint8Array([0x62, 0x32]) }

// or

const users = User[2].decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// users => [ { name: Uint8Array([0x61,0x31]), name2: Uint8Array([0x61,0x32]) }, ... ]
```

## DynamicStructBuffer

`StructBuffer` 只会"按字节切", 遇到带长度前缀的变长字段就只能干瞪眼。`DynamicStructBuffer`
是给这类报文用的: 字段按声明顺序消费一段游标, 长度可以来自前面任意字段, 嵌套结构体
可以递归, `ref()` 还能在 encode 时把实际长度回填回长度字段。

```ts
import {
  DynamicStructBuffer,
  ref,
  uint8_t,
  uint16_t,
} from "struct-buffer";

const Msg = new DynamicStructBuffer(
  "msg",
  {
    type: uint8_t,
    len: uint16_t, // 后面 payload 的字节数
    payload: uint8_t[ref("len")],
    name: uint8_t[8],
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

decode 结果和 encode 入参的类型都是推出来的, 不用手写(见下面的[类型推导](#类型推导))。

### 嵌套列表

下标就是维度, `ref` 长度就是"几个":

```ts
const Item = new DynamicStructBuffer("item", { id: uint32_t });
const Grid = new DynamicStructBuffer("grid", {
  n: uint8_t,
  rows: Item[ref("n")], // 由 n 决定个数
  pairs: Item[2][2], // 固定 2 x 2
});
Grid.decode(view);
// => { n: 2, rows: [{ id }, { id }], pairs: [[{ id }, { id }], [{ id }, { id }]] }
```

### 变长字段工厂

`uint8_t[ref(...)]` 和 `uint8_t[n]` 就是字节字段(连续的 1 字节无符号元素), 只有"剩下的
全部字节"要显式说:

```ts
import { rest, records, variant, framed } from "struct-buffer";

new DynamicStructBuffer("pkt", {
  len: uint16_t,
  payload: uint8_t[ref("len")], // Uint8Array
  tail: rest(), // 吃掉剩下的全部字节
});
```

- `uint8_t[n]` / `uint8_t[ref(...)]`: 连续的 `uint8_t`, 即一段字节, 解成 `Uint8Array`
- `rest()`: 声明式长度前缀的终点标记
- `records(Sub)`: 定长子记录一直填到末尾; 子结构体含变长字段会在**构造期**报错
- `variant(key, cases)`: 变体联合, 判别字段须声明在它之前, 分支字段与判别字段平级
  (运行时平铺进父对象, 所以 `decode()` 出来就是父对象上的字段)
- `framed(reader, writer)`: 自定界子帧循环, 反复读自带长度的子帧直到 `reader` 返回
  `null`. 与其做一个猜错一半的 DSL, 不如让调用方老实描述"怎么跳过一个子帧":

```ts
framed(
  {
    read: (c) => {
      if (c.left < 2) return null; // 不够一个头 ⇒ 流结束
      const op = c.u8("op");
      const n = c.u8("flen");
      return { op, body: c.bytes(n, "body") };
    },
  },
  {
    write: (w, v) => {
      w.u8(v.op);
      w.u8(v.body.length);
      w.bytes(v.body);
    },
  }
);
```

`uint8_t[n]` 是**定宽**字节字段(`char name[8]` 那种): encode 写满 n 字节(短补 NUL / 长截断)。
它同时也是**不定宽**字节字段的写法 —— `uint8_t[ref("len")]` 就是"以 `len` 为字节数的那一段"。
decode 一律给满 n 字节, **不在 NUL 处截断** —— 截断是 C 风格字符串的约定而不是字节属性,
定宽字段也常见空格补位或满宽正文, 猜错就是静默丢数据。要截自己切, NUL 是单字节且不会
出现在多字节序列中间, 所以切在它上面不会劈开 UTF-8 / GBK:

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
const Msg = new DynamicStructBuffer("msg", {
  msg_type: uint8_t,
  msg: uint8_t[ref("msg_size")],
  name: uint8_t[ref("name_size")],
});

const data = Msg.decode(view);
data.msg.toString(); // ok
data.no_such_field; // 编译期报错
Msg.encode({ msg_typo: 1 }); // 编译期报错
```

几个容易踩的点:

- **encode 入参是 Partial, 且长度字段不用给** —— encode 时由框架回填
- **`uint8_t[n]` / `rest()` 解出来是 `Uint8Array`, 写回去也只收 `Uint8Array`** ——
  字节只有一种形态; 传字符串 / `number[]` 编译期就报错(见"文本与编码")
- **variant 分支字段在父对象上**(`data.name`, 不是 `data.body.name`), 类型上是可选的;
  不做按判别值收窄的 union
- **`DynamicStructBuffer` 的泛型顺序是 `<S, D, E>`**(`S` 是字段表)。想显式指定类型时
  写 `new DynamicStructBuffer<any, MyType>(...)` —— `S` 填 `any` 就是放弃推导

单独用 `InferDef<typeof Msg.struct>` / `InferType<typeof Msg>` 也能拿到类型.

## 文本与编码

库里**没有字符串类型**, 而且这一层**完全不知道字节是不是文本**。这不是遗漏, 是刻意的:
线上的字节形状才是类型, 而"这些字节是什么字符"是协议属性。真实报文的编码有 UTF-8 /
UTF-16LE / UTF-16BE / GBK / GB18030 / Big5 / Shift-JIS / codepage..., 把其中一种当默认
就是在替协议做决定。

所以 `uint8_t[n]` / `rest()` 的 encode 入参只有 `Uint8Array`: 传字符串或 `number[]` 编译期就报错,
绕过类型运行时也报错。`encode({ name: "hello" })` 不会"帮你按 UTF-8 转一下" —— 那等于
悄悄替你选了编码, 而选了之后 GBK / UTF-16LE 的报文就静默错了。

本库一行编解码都没实现 —— `TextDecoder` / `TextEncoder` 全程委托平台, 所以
"库里支持哪种编码"这个问题不成立: 解码用平台 `TextDecoder` 就能吃下几十种 label。

```ts
const Msg = new DynamicStructBuffer("msg", {
  name_size: uint8_t,
  name: uint8_t[ref("name_size")], // 出 Uint8Array, 长度是字节数
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
拿字符数当长度会把正文截掉。`uint8_t[ref(...)]` 会在 encode 时按实际字节数回填 `ref` 长度字段。

调试用 `TEXT(bytes, new TextDecoder("gbk"))`, 它会按给定编码渲染字节。

## bits
```ts
import { uint32_t, bits, DynamicStructBuffer } from "struct-buffer";

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
const view = EFLAG.encode(
  {
    PF: 1,
    ZF: 1,
    IF: 1,
  },
  littleEndian
);
// => <44 02 00 00>
```

> 位名对应的值是**一个位号**, 取值只能是 0/1; 存储支持 1/2/4 字节。位号越界或取值非 0/1 会
> 直接报错, 而不是悄悄串到相邻位上。

## bitFields
```ts
import { uint8_t, bitFields, DynamicStructBuffer, sbytes as b, } from "struct-buffer";

const bf = bitFields(uint8_t, {
  a: 1,
  b: 2,
  c: 3,
});

const v = bf.encode({
  a: 1,
  b: 2,
  c: 3,
});
// => <1D>

const data = bf.decode(b("1D"));
// => { a: 1, b: 2, c: 3 }
```

> 每个字段占**连续几位**(这里是位宽, 不是位号), 值要放得进声明的位宽。存储支持 1/2/4 字节,
> 位宽总和不能超过存储宽度 —— 否则构造期就报错。

## delimited

单个**自定界**字段: 读一个, 然后把游标停在它后面, 后续字段继续。尺寸由 reader 自己推进
`Cursor` 决定 —— 引擎不需要提前知道, 所以 NUL 结尾的 C 字符串这类"长度只能跑起来才知道"
的字段在这里是自然的。

```ts
import { delimited, DecodeError, DynamicStructBuffer, float } from "struct-buffer";

const cstr = () =>
  delimited<string>(
    {
      read: (c) => {
        const at = c.pos;
        while (c.left > 0) {
          if (c.view.getUint8(c.pos++) === 0) {
            // 已经扫过整段正文, 直接从 view 取: bytes() 只能从当前位置读,
            // 而游标此刻已经停在结尾 NUL 之后了
            const n = c.pos - at - 1;
            const view = new Uint8Array(
              c.view.buffer,
              c.view.byteOffset + at,
              n
            );
            return new TextDecoder().decode(view);
          }
        }
        throw DecodeError.reason(c.where, at, "没遇到结尾 NUL");
      },
    },
    {
      write: (w, v) => {
        w.bytes(new TextEncoder().encode(v));
        w.u8(0);
      },
    }
  );

// 变长字段夹在定长字段中间
const Player = new DynamicStructBuffer("Player", {
  hp: float,
  name: cstr(),
  mp: float,
});
```

### delimited 与 framed 的区别

两者只差**读几个**:`framed` 贪婪读到缓冲区末尾, 所以**只能放在结构体最后一个字段**;
变长字段夹在中间时它会把后面字段的字节也当成下一个子帧吃掉(而且失败时已经吃掉了,
后面字段直接报越界)。`delimited` 读一个就停。

| | `framed` | `delimited` |
| --- | --- | --- |
| 解出来是 | `T[]` | `T` |
| 读几个子帧 | 直到字节耗尽 | 一个 |
| 能放中间吗 | **不能** | 能 |
| 适合 | `op\|flen\|body` 这种流式布局 | 夹在中间的 C 字符串、单个 TLV |

reader 返回 `null` 的含义也不同:`framed` 里是"流结束"(干净收手), `delimited` 里是
"这一帧不完整"—— 后者会抛 `DecodeError`, 因为位置已经不可信了。

`delimited` 不检查"reader 有没有推进游标":单次读没有循环, 空 C 字符串消费 0 字节是合法的。
那个死循环检查只对 `framed` 有意义。

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
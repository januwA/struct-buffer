## struct-buffer

用声明式结构体读写 `ArrayBuffer`: 描述字段布局, 就能从 `DataView` 解码出 JS 对象, 或把
JS 对象编码回字节。默认大端; 支持嵌套、变长、长度回填与位域。

## Install
```
$ npm i struct-buffer
```

## 快速开始
```ts
import { bytes, struct, uint32_t, sbytes } from "struct-buffer";

const Player = struct("Player", {
  hp: uint32_t,
  mp: uint32_t,
  name: bytes(3),
});

const view = sbytes("00 00 00 0a 00 00 00 64 61 62 63");

Player.decode(view);
// => { hp: 10, mp: 100, name: Uint8Array [0x61, 0x62, 0x63] }

Player.encode({
  hp: 10,
  mp: 100,
  name: new Uint8Array([0x61, 0x62, 0x63]),
});
// => <00 00 00 0a 00 00 00 64 61 62 63>
```

`struct(...)` 返回一个 codec, 自带 `decode` / `decodeLenient` / `encode`, 也能直接嵌进别的结构体。

## 运行时

产物只依赖 ECMAScript 标准本身, 不引用任何宿主全局, 可用于 Node / 浏览器 / Bun / Frida 17+。

- ESM(默认): `import { struct } from "struct-buffer"`
- CJS: `const { struct } = require("struct-buffer")`
- IIFE: 浏览器 `<script>` 的全局 `StructBuffer`

## 标量类型

| 有符号 | 无符号 | C / Windows 里的对应写法 |
| --- | --- | --- |
| `int8_t` | `uint8_t` | `signed char` / `unsigned char`、`BYTE` |
| `int16_t` | `uint16_t` | `short`、`WORD` |
| `int32_t` | `uint32_t` | `int`、`DWORD` |
| `int64_t` | `uint64_t` | `long long`、`QWORD` |
| `float` | `double` | 4 / 8 字节浮点 |

8 字节类型的值类型是 `number`(超过 `2^53` 会掉精度)。

## registerType
自定义宽度或浮点类型:

```ts
import { list, registerType, sbytes, struct } from "struct-buffer";

const myShort = registerType(2, false);
const myFloat = registerType(4, true, "float"); // kind 默认 "int"

const Player = struct("Player", {
  hp: myShort,
  mp: myShort,
  pos: list(myShort, 2),
});

Player.decode(sbytes("00 02 00 0a 00 64 00 c8"));
// => { hp: 2, mp: 10, pos: [ 100, 200 ] }
```

## 嵌套 struct
```ts
import { int16_t, struct, uint16_t, uint32_t, uint8_t } from "struct-buffer";

const Gamepad = struct("Gamepad", {
  wButtons: uint16_t,
  bLeftTrigger: uint8_t,
  bRightTrigger: uint8_t,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

const State = struct("State", {
  dwPacketNumber: uint32_t,
  Gamepad,
});

State.encode({
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

## 字节与数组

```ts
bytes(8)                 // 定宽 8 字节 => Uint8Array; encode 写满(短补 NUL / 长截断)
bytes(ref("n"))          // 长度取自字段 n
bytes("rest")            // 等价于 rest(): 吃掉剩余全部字节
list(T, 2)               // 定长数组 => T[]
list(T, ref("n"))        // 长度取自字段 n
list(T, ref("n"), { sync }) // 带有特征标记同步对齐的数组
list(list(T, 2), 2)      // 多维: 2 x 2
records(Sub)             // 子记录一直填到末尾(Sub 须定长)
records(Sub, ref("n"))   // 或显式给个数
skip(4)                  // 占位 4 字节, 不出现在结果里(encode 写 0)
skipUntil(pat, opts)     // 扫描特征字节并调整游标, 不出现在结果里
```

## 动态对齐与特征寻标: list.sync / skipUntil

用于元素大小不一、含有未知变长填充或需根据特征魔数 (Magic / Sync Marker) 定位下一个数据的场景。支持固定模式串或从已解析字段动态生成 (`Uint8Array | DataView`)。

### 1. `list` 同步选项 (`sync`)
针对数组容器。解码第 1 个及后续元素前，自动在流中搜索特征 Pattern 并按偏移量对齐游标，保持元素结构体纯粹：

```ts
import { list, ref, struct, uint16_t, uint32_t, uint8_t } from "struct-buffer";

const Item = struct("Item", {
  inc_id: uint32_t,
  id: uint32_t,
  define_id: uint32_t,
  type: uint16_t,
}, { littleEndian: true });

const Packet = struct("Packet", {
  count: uint8_t,
  items: list(Item, ref("count"), {
    sync: {
      // 动态根据首个 item 的 id 编码特征字节进行寻标
      pattern: (_prev, first) => uint32_t.encode(first.id, true),
      offset: -4, // 相对 pattern 匹配位置的元素起始偏移量
    },
  }),
}, { littleEndian: true });
```

### 2. 字段级跳转 `skipUntil`
作为结构体字段使用，跳过未知的变长字节直到遇到指定标记。类型为 `never`，**不出现在解码结果中**：

```ts
import { skipUntil, struct, uint32_t, uint16_t } from "struct-buffer";

const Item = struct("Item", {
  inc_id: uint32_t,
  id: uint32_t,
  define_id: uint32_t,
  type: uint16_t,
  // 读完当前 item 后，根据本 item 的 id 寻标下一个 item 的起始位置
  _next: skipUntil((ctx) => uint32_t.encode(ctx.id, true), {
    offset: -4,
    optional: true, // 最后一个元素后面没有标记时不报错
  }),
}, { littleEndian: true });
```

- `pattern`: 固定 `Uint8Array | DataView`，或从当前对象计算 `(ctx) => Uint8Array | DataView`。
- `offset`: 相对匹配位置的偏移（默认 `0`）。
- `optional`: 默认 `false`（找不到抛 `DecodeError`）；`true` 时不报错。
- `to`: 找不到时的游标行为：`"stay"`（默认，留在原地）或 `"end"`（跳到缓冲区末尾）。


## 变长与长度回填

`ref("len")` 让字段长度取自 `len`, 并在 encode 时把实际字节数回填进去(不改入参对象)。
`ref(field, transform?)` 的第二参可把长度换算一下, 例如长度头含额外头部字节。
`littleEndian` 省略则逐级继承父级, 最近显式配置赢, 默认大端。

```ts
import { bytes, ref, struct, uint16_t, uint8_t } from "struct-buffer";

const Msg = struct(
  "msg",
  {
    type: uint8_t,
    len: uint16_t,
    payload: bytes(ref("len")),
    name: bytes(8),
  },
  { littleEndian: true }
);

Msg.encode({
  type: 1,
  payload: new Uint8Array([0x41, 0x42]),
  name: new Uint8Array([0x61, 0x62, 0x63]),
});
// len 不用给: encode 自动回填 payload 的字节数
```

`transform(raw, ctx)` 解码时把长度字段的值换算成字节数, 编码时同样用它算写入宽度; 因此带
`transform` 时 encode 不会自动回填, 需要自己给长度字段:

```ts
const Pkt = struct("pkt", {
  len: uint16_t,                       // 5 = 3 字节数据 + 2
  data: bytes(ref("len", (v) => v - 2)),
});

Pkt.encode({ len: 5, data: new Uint8Array([1, 2, 3]) });
```

## variant

判别字段须声明在 `variant` 之前; 分支字段与判别字段**平级**。

```ts
import { bytes, struct, uint32_t, uint8_t, variant } from "struct-buffer";

const V = struct("v", {
  msg_type: uint8_t,
  body: variant("msg_type", {
    1: { name: bytes(3) },
    2: { x: uint32_t, y: uint32_t },
  }),
});

V.decode(Uint8Array.from([1, 0x61, 0x62, 0x63]));
// => { msg_type: 1, name: Uint8Array [0x61, 0x62, 0x63] }

V.encode({ msg_type: 2, x: 1, y: 2 });
```

无对应分支时 decode 抛 `DecodeError`、encode 抛 `EncodeError`。

## bits / bitFields

```ts
import { bitFields, bits, sbytes as b, uint32_t, uint8_t } from "struct-buffer";

// bits: 每个键对应一个位号, 取值 0/1
const EFLAG = bits(uint32_t, { CF: 0, PF: 2, AF: 4, ZF: 6, SF: 7, TF: 8, IF: 9, DF: 10, OF: 11 });
EFLAG.decode(new Uint32Array([0x246]), true);
// => { CF: 0, PF: 1, AF: 0, ZF: 1, SF: 0, TF: 0, IF: 1, DF: 0, OF: 0 }
EFLAG.encode({ PF: 1, ZF: 1, IF: 1 }, true);
// => <44 02 00 00>

// bitFields: 每个键占连续几位
const bf = bitFields(uint8_t, { a: 1, b: 2, c: 3 });
bf.decode(b("1D"));
// => { a: 1, b: 2, c: 3 }
bf.encode({ a: 1, b: 2, c: 3 });
// => <1D>
```

两者存储只支持 1/2/4 字节, 越界/溢出直接报错。

## 自定义字段: codec / delimited / framed

尺寸由 reader 推进 `Cursor` 决定, 适合 NUL 结尾字符串这类长度跑起来才知道的字段。

| | `framed` | `delimited` | `codec` |
| --- | --- | --- | --- |
| 解出来是 | `T[]` | `T` | `T` |
| 读几个 | 直到字节耗尽 / reader 返回 `null` | 一个 | 一个字段(reader 决定推进多少) |
| 能放中间吗 | 不能, 只能作最后一个字段 | 能 | 能 |

```ts
import { codec, delimited, DecodeError, float, struct } from "struct-buffer";

const cstr = () =>
  delimited<string>({
    read: (c) => {
      const at = c.pos;
      while (c.left > 0) {
        if (c.view.getUint8(c.pos++) === 0) {
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

const Player = struct("Player", { hp: float, name: cstr(), mp: float });
```

`codec` 与 `delimited` 的 reader 返回 `null` 时视为字段不完整并报错; `framed` 视为流结束。

## 工具函数

```ts
import { createDataView, makeDataView, sbytes as b, sbytes2 as b2, sview, TEXT } from "struct-buffer";

createDataView(3);              // <00 00 00>
makeDataView([1, 2, 3]);        // <01 02 03>, 尊重 subarray 的 byteOffset/byteLength 窗口
b("01 02 03");                  // 十六进制字符串 => DataView
b2("abc\\x1\\x2\\x3", new TextEncoder()); // 十六进制与文本混合
sview([2, 0, 0, 1]);            // => "02 00 00 01"
TEXT(makeDataView([0x61, 0x62, 0x01, 0x78]), new TextDecoder()); // => "ab.x"
```

`TEXT()` / `sbytes2()` 的文本编码器/解码器由调用方注入(`ITextEncoder` / `ITextDecoder`),
`TEXT()` 必传解码器; `sbytes2()` 只在含非十六进制文本时需要编码器。

## 类型推导

`decode()` 结果类型、`encode()` 入参类型都由字段表推出, 不用手写:

```ts
const data = Msg.decode(view);
data.payload; // Uint8Array
data.typo;    // 编译期报错
```

`encode` 入参是 `Partial`, 长度字段不用给。也可直接用 `InferType<typeof Player>` /
`InferEncode<typeof Player>` / `InferDef<typeof Player.struct>`。

## 浏览器
```html
<script src="https://unpkg.com/struct-buffer"></script>
<script>
  const { struct, bytes, uint32_t } = StructBuffer;
</script>
```

## build / test
```
$ npm test
$ npm run build
```

esbuild 产出 `dist/esm/index.mjs`(ESM)、`dist/cjs/index.cjs`(CJS)、
`dist/iife/struct-buffer.global.js`(IIFE) 与 `dist/types/*.d.ts`。

## See also:
  - [See the test for more examples](https://github.com/januwA/struct-buffer/blob/main/test/basic.test.ts)
  - [DataView](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/DataView)
  - [C_data_types](https://en.wikipedia.org/wiki/C_data_types)

## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { float, string_t, StructBuffer, pack } from "struct-buffer";

const struct = new StructBuffer("Player", {
  hp: float,
  mp: float,
  name: string_t[3],
});

const buffer: DataView = pack("2f3s", 10, 100, "abc");

// decode
const data = struct.decode(buffer);
// data => { hp: 10, mp: 100, name: 'abc' }

// encode
const view = struct.encode({
  hp: 10,
  mp: 100,
  name: "abc",
});
// view => <41 20 00 00 42 c8 00 00 61 62 63>
```

## Use in browser
```html
<script src="struct-buffer.js"></script>
<script>
  const { DWORD, string_t, StructBuffer, uint32_t } = window.StructBuffer;
</script>
```

## Use ["type"](https://github.com/januwA/struct-buffer/blob/main/src/types.ts) for conversion

```ts
import { DWORD } from "struct-buffer";

// encode
const view = DWORD[2].encode([1, 2]); 
// view => <00 00 00 01 00 00 00 02>

// decode
const data = DWORD[2].decode(view);
// data => [ 1, 2 ]
```

## register Type
```ts
const myShort = registerType("short", 2, false);

const struct = new StructBuffer("Player", {
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

## typedef
```ts
const HANDLE = typedef("HANDLE", DWORD);
HANDLE.size // 4
HANDLE.unsigned // true
```


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

XINPUT_GAMEPAD = new StructBuffer("XINPUT_GAMEPAD", {
  wButtons: WORD,
  bLeftTrigger: BYTE,
  bRightTrigger: BYTE,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

XINPUT_STATE = new StructBuffer("XINPUT_STATE", {
  dwPacketNumber: DWORD,
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

## parse c-struct
```ts
import { CStruct } from "struct-buffer";

const cStruct = `
//
// Structures used by XInput APIs
//
typedef struct _XINPUT_GAMEPAD
{
    WORD                                wButtons;
    BYTE                                bLeftTrigger;
    BYTE                                bRightTrigger;
    SHORT                               sThumbLX;
    SHORT                               sThumbLY;
    SHORT                               sThumbRX;
    SHORT                               sThumbRY;
} XINPUT_GAMEPAD, *PXINPUT_GAMEPAD;

typedef struct _XINPUT_STATE
{
    DWORD                               dwPacketNumber;
    XINPUT_GAMEPAD                      Gamepad;
} XINPUT_STATE, *PXINPUT_STATE;

typedef struct _XINPUT_VIBRATION
{
    WORD                                wLeftMotorSpeed;
    WORD                                wRightMotorSpeed;
} XINPUT_VIBRATION, *PXINPUT_VIBRATION;

typedef struct _XINPUT_BATTERY_INFORMATION
{
    BYTE BatteryType;
    BYTE BatteryLevel;
} XINPUT_BATTERY_INFORMATION, *PXINPUT_BATTERY_INFORMATION;
`;

const structs = CStruct.parse(cStruct);
sizeof(structs.XINPUT_GAMEPAD) // 12
sizeof(structs.XINPUT_STATE) // 16
sizeof(structs.XINPUT_VIBRATION) // 4
sizeof(structs.XINPUT_BATTERY_INFORMATION) // 2
```

## struct list
```ts
const User = new StructBuffer("User", {
  name: string_t[2],
  name2: string_t[2],
});

const Users = new StructBuffer("Users", {
  users: User[2],
});

const data = Users.decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// data.users.length => 2
// data.users[0] => { name: "a1", name2: "a2" }
// data.users[1] => { name: "b1", name2: "b2" }

// or

const users = User[2].decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// users => [ { name: 'a1', name2: 'a2' }, { name: 'b1', name2: 'b2' } ]
```

## DynamicStructBuffer

`StructBuffer` 只会"按字节切", 遇到带长度前缀的变长字段就只能干瞪眼。`DynamicStructBuffer`
是给这类报文用的: 字段按声明顺序消费一段游标, 长度可以来自前面任意字段, 嵌套结构体
可以递归, `ref()` 还能在 encode 时把实际长度回填回长度字段。

```ts
import {
  DynamicStructBuffer,
  ref,
  string_t,
  uint8_t,
  uint16_t,
} from "struct-buffer";

const Msg = new DynamicStructBuffer(
  "msg",
  {
    type: uint8_t,
    len: uint16_t, // 后面 payload 的字节数
    payload: uint8_t[ref("len")],
    name: string_t[8],
  },
  { littleEndian: true }
);

Msg.decode(view);
// => { type: 1, len: 2, payload: Uint8Array, name: "abc" }

Msg.encode({ type: 1, payload: [0x41, 0x42], name: "abc" });
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

`uint8_t[ref(...)]` 只能读裸字节, 字符串和"剩下的全部"要显式说:

```ts
import { blob, rest, records, variant, framed } from "struct-buffer";

new DynamicStructBuffer("pkt", {
  len: uint16_t,
  payload: blob(ref("len")), // Uint8Array
  tail: rest(), // 吃掉剩下的全部字节
});
```

- `blob(spec)`: `Uint8Array`, 长度是字节数
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

`string_t[n]` 是**定宽**字段(`char name[8]` 那种): encode 写满 n 字节(短补 NUL / 长截断),
decode 在第一个 NUL 处截断. `string_t[ref(...)]` 才是变长, 整段解码不做截断 —— NUL
在那里属于正文.

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
  name: string_t[ref("name_size")],
});

const data = Msg.decode(view);
data.msg.toString(); // ok
data.no_such_field; // 编译期报错
Msg.encode({ msg_typo: 1 }); // 编译期报错
```

几个容易踩的点:

- **encode 入参是 Partial, 且长度字段不用给** —— encode 时由框架回填
- **字符串一律是 `string`**: 引擎里字符串字段就是 `blob` 的 text 形态, 下标只决定
  字节数(`string_t[2][2]` 是 2 个字 *2 字节*的字符串, 不是字符串数组)
- **decode 值类型 ≠ encode 入参类型**: `rest()`/`blob()` 解出来是 `Uint8Array`,
  写回去接受 `Uint8Array | number[]`
- **variant 分支字段在父对象上**(`data.name`, 不是 `data.body.name`), 类型上是可选的;
  不做按判别值收窄的 union
- **`DynamicStructBuffer` 的泛型顺序是 `<S, D, E>`**(`S` 是字段表)。想显式指定类型时
  写 `new DynamicStructBuffer<any, MyType>(...)` —— `S` 填 `any` 就是放弃推导

单独用 `InferDef<typeof Msg.struct>` / `InferType<typeof Msg>` 也能拿到类型.

## StructBuffer to c-struct
```ts
import { CStruct } from "struct-buffer";

const XINPUT_GAMEPAD = new StructBuffer("XINPUT_GAMEPAD", {
  wButtons: WORD,
  bLeftTrigger: BYTE,
  bRightTrigger: BYTE,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t[2],
});
const cStruct = CStruct.from(XINPUT_GAMEPAD);

// console.log(cStruct) => 
typedef struct _XINPUT_GAMEPAD
{
    WORD wButtons;
    BYTE bLeftTrigger;
    BYTE bRightTrigger;
    int16_t sThumbLX;
    int16_t sThumbLY;
    int16_t sThumbRX;
    int16_t sThumbRY[2];
} XINPUT_GAMEPAD, *XINPUT_GAMEPAD;
```

## "string_t" Truncate when encountering 0
```ts
string_t[4].decode(new Uint8Array([0x61, 0x62, 0x63, 0x64]); // abcd
string_t[4].decode(new Uint8Array([0x61, 0x62, 0x00, 0x64]); // ab
```

## bits
```ts
import { DWORD, bits, StructBuffer } from "struct-buffer";

const EFLAG_DATA = 0x00000246;
const littleEndian = true;
const EFLAG = bits(DWORD, {
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

## bitFields
```ts
import { uint8_t, bitFields, StructBuffer, sbytes as b, } from "struct-buffer";

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

## Inject

Customize the working content of decode and encode

```ts
const c_str = new Inject(
  // decode
  (view: DataView, offset: number) => {
    const buf: number[] = [];
    let size = offset + 0;
    while (true) {
      let data = view.getUint8(size++);
      if (data === 0) break;
      buf.push(data);
    }

    return {
      size: size - offset,
      value: new TextDecoder().decode(new Uint8Array(buf)),
    };
  },

  // encode
  (value: string) => {
    const bytes: Uint8Array = new TextEncoder().encode(value);
    const res = realloc(bytes, bytes.byteLength + 1);
    return res;
  }
);
```

See `Inject.test.ts` file.

## [pack and unpack](https://docs.python.org/3/library/struct.html)
```ts
import { pack, pack_into, unpack, unpack_from, iter_unpack, calcsize, Struct, sbytes as b } from "struct-buffer";

pack("b2xb", 2, 1)
// => <02 00 00 01>

unpack("b2xb", b("02 00 00 01"))
// => [ 2, 1 ]

calcsize("hhl")
// => 8


const [hp, mp, name] = unpack(
  ">II3s",
  b("00 00 00 64 00 00 00 0A 61 62 63")
);
expect(hp).toBe(100);
expect(mp).toBe(10);
expect(name).toBe('abc');
```

Note: Without "@, =, P", the default byte order is ">"

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

TEXT(pack("3s2b3s2I", "abc", 1, 2, "xyz", 8, 9))
// => "abc..xyz........"
```

## test
> $ npm test

## build
> $ npm run build

## See also:
  - [See the test for more examples](https://github.com/januwA/struct-buffer/blob/main/test/test.test.ts)
  - [DataView](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/DataView)
  - [C_data_types](https://en.wikipedia.org/wiki/C_data_types)
  - [Built-in types (C++)](https://docs.microsoft.com/en-us/cpp/cpp/fundamental-types-cpp?view=msvc-160)
  - [C++ Bit Fields](https://docs.microsoft.com/en-us/cpp/cpp/cpp-bit-fields?view=msvc-160)
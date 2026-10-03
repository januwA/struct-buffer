## 6.0.0

6.0 只做减法: 把定位模糊、又在真实项目里用不上的外围功能砍掉, 并修掉两个把类型撒谎的
bug。`DynamicStructBuffer` 已经是解析变长报文的正解, 格式串那套表达力不够、也没人靠它读
长度前缀。

### ✨ 新增

- `DynamicStructBuffer`: decode 结果与 encode 入参类型全部自动推出来, 字段名拼错编译期就报错
- `InferType` / `InferDef` / `InferEncodeDef` 导出, 可以单独拿来推任意字段表
- `rest` / `records` / `framed` / `delimited` / `variant` 声明式字段工厂
- `decodeLenient`: 坏字段变 `undefined` 并收集错误, 而不是整帧丢掉

### 🐛 修复

- **嵌套 `DynamicStructBuffer` 收不到父级的 `littleEndian`**: 归一化字段表时, 自带 def 的结构体
  曾直接复用**自己构造期**算好的那份 def, 而那份 def 是拿 `littleEndian ?? false` 算的 ——
  于是"没配"被焊死成大端, 父级之后配成小端也传不进去。旧 `StructBuffer` 那条分支一直是对的
  (`config.littleEndian ?? inheritedLE`), 所以旧结构体嵌进新引擎正常、新结构体嵌新结构体才
  坏 —— 之前没有任何用例覆盖到后者。现在两条分支合成一条链式规则: 最近的显式配置赢,
  没配就继承父级
- **`int64_t` 之前实际是无符号的**: 它是从 `longlong` typedef 来的, 而 `longlong` 没显式
  传 `unsigned`, 落进默认的 `true`, 于是走的是 `getBigUint64` —— `0xFFFFFFFFFFFFFFFF`
  解出来是 `18446744073709551615` 而不是 `-1`
- **8 字节类型的值类型统一是 `number`**: 之前 decode 把 `bigint` 原样抛给调用方, 声明
  类型和运行时类型对不上。代价是超过 `2^53` 的值会掉精度
- **`float` 的别名会静默按整数编解码**: 选访问器是拿"名字里有没有 `float`"来判的
  (`float` 的 `size=4` / `unsigned=true` 单看这两个属性只能落到 `getUint32`), 于是
  `typedef("my_float", float)` 造出来的类型不含这个名字, `1.5` 被编成 `00 00 00 01` ——
  不报错、字节还合法, 要到对端才发现。类型身份改由 `kind` 字段携带, 名字不再参与派发
- 定长字节字段(`uint8_t[n]`)encode 现在写满 n 字节(短补 NUL / 长截断) —— 之前短值会把后面
  所有字段整体前移, 而 `sizeof()` 报的仍是 n
- `frameReader.read` 类型允许返回 `null`(文档一直是这么说的)
- 判别字段没有对应分支 / `ref` 指向非法值时, 错误消息不再被塞进 `hex:` 槽位
- 类型报不出名字之后, "不存在的字节形状" 从一句 `Unrecognized [object Object] type.` 改成
  带上 `size` / `unsigned` / `kind` 的具体描述

### 📚 文档

- README 补 `DynamicStructBuffer`、类型推导、10 个类型的对照表与别名归属, 另加一节
  「文本与编码」说明为什么库里没有字符串类型

### 💥 破坏性变更

**类型不再有名字**: `registerType` 去掉第一个参数, `StructType.names` / `isName()` / `typedef()`
一并删除

类型的唯一职责是描述线上的字节形状, 名字对它没有任何用处 —— 派发看的是
`(size, unsigned, kind)`。C / C++ / Windows 的别名(`BYTE` / `DWORD` / `long long` ...)本来
也只是挂在 `names` 数组里当文档, 现在一个都不导出: 想表达"C 里的那个 DWORD", 直接写
`uint32_t`。

```ts
registerType("int", 4, false)                  →  registerType(4, false)
registerType("float", 4, true)                 →  registerType(4, true, "float")
typedef("HANDLE", uint32_t)                    →  uint32_t          // 直接用现成的
uint8_t.names.includes("BYTE")                 →  (删除)
```

`kind` 默认 `"int"`, 只有浮点需要显式写。删掉 `typedef` 是因为它唯一的职责就是造一个**有名字的**
别名, 名字没了它就没有存在理由 —— 顺带也修掉了它给 float 换名字时丢浮点身份的那个 bug。

**删除 `StructBuffer`**(`src/struct-buffer.ts`)—— 现在只有一个结构体引擎

旧 `StructBuffer` 是"每个字段各自持有状态、自己按 offset 递归"的引擎, 新 `DynamicStructBuffer`
是"构造期把字段表归一化成 `Field[]`, decode/encode 只做一件事: 拿 `Cursor`/`Writer` 从头走到
尾"。功能上前者是后者的子集(新引擎多出 `ref` / `framed` / `delimited` / `records` /
`variant` / `decodeLenient`, 旧引擎一样都表达不了), 复杂度和 bug 面却是反过来的。

迁移是机械的:

```ts
new StructBuffer("Player", { ... })          →  new DynamicStructBuffer("Player", { ... })
sb.byteLength                                 →  sb.getByteLength()      // 变长字段要传样本对象
struct.byteLength                             →  struct.getByteLength()
```

**同时删除 `sizeof()`**

`sizeof(type)` 这个自由函数没了, 拆成两处、各自只有一个算法来源:

- `StructType.getSize(ctx?)` —— 单个类型(含下标展开)的字节数
- `DynamicStructBuffer.getByteLength(obj?)` —— 整个结构体; 全定长时不必传对象, 有变长字段时
  **直接把对象 encode 一遍量出来**, 而不是另写一套尺寸推算

删它的理由不是"有更好的替代", 而是它**在结构体上是错的**。`sizeof` 对 `StructBuffer` 会按
`maxSize` 做 C 风格对齐补位, 而这套补位从来没在 `encode` 里实现过:

```ts
const B = new StructBuffer("B", { a: uint32_t, b: A, c: uint8_t }) // A = { u64, u8 }
sizeof(B)            // 16
B.encode(...).byteLength  // 14
```

也就是说全库最危险的函数恰好是尺寸问题的标准答案 —— 按它切片就会错位, 而且要到对端才
发现。对齐补位因此没有被"移植"到新引擎: 真要补位就用 `skip()` 显式写出来, 让字节布局在
声明处看得见。`byteLength` / `maxSize` 一并删除(`maxSize` 只服务于上面那个错误的对齐)。

**删除 `CStruct`**(`src/c-struct.ts`)

- 去掉 C 头文件解析(`CStruct.parse`)与反向生成(`toCStruct`)两个方向的映射。协议表还是
  手写, 只是不再假装能从头文件自动生成 —— 生成的 C 代码没人真拿去编译过

**删除 `py-struct`**(`src/py-struct.ts`)

- 去掉 `pack` / `pack_into` / `unpack` / `unpack_from` / `iter_unpack` / `calcsize` /
  `Struct`。格式串表达不了长度前缀、变长正文、未知/保留字节这些真实报文里最常见的形状

**删除 `blob()`: 字节字段只有一个写法**

`uint8_t[n]` 和 `blob(n)` 一直都能描述同一段字节 —— 判据是 `size === 1 && unsigned &&
deeps.length === 1`, 两者写出**完全相同**的字节, 线上格式、长度回填、ref 解析都一样。
区别只在解出来的容器: 一个 `number[]`, 一个 `Uint8Array`。同一个含义有两种表示, 就得由
调用方去猜该用哪个 —— 而这两个 API 各自还有一堆只有对方才有的毛病: `blob()` 裸调用会
抛 `Cannot use 'in' operator`, `blob({stride})` 静默只读一部分字节, `blob(uint8_t[4])`
报一个跟调用方式对不上的错。

于是让 `uint8_t[n]` 直接表示字节, `blob()` 删除:

```ts
blob(n)                  →  uint8_t[n]
blob(ref("len"))         →  uint8_t[ref("len")]

struct.decode(view).blobField    // number[]   →  Uint8Array
```

只认"**连续的 1 字节无符号元素**", 两个反例都保持原样:

- 嵌套(`uint8_t[2][3]`)仍是 `number[][]` —— 形状对调用方有意义(第一行 / 第二行)
- `int8_t[3]` 仍是 `number[]` —— 有符号要做符号扩展, 那是**取值转换**而不是字节重解释。
  混进来等于库替调用方挑了怎么读

encode 入参两种都收(`Uint8Array | number[]`)。`bits` / `bitFields` 虽然也是 1 字节无符号,
但解出来是**对象**, 底层那层 `number[]` 是位映射的输入, 因此不走字节段。

> 类型层有个已知缺口: `uint8_t[2][3]` 运行时给 `number[][]`, 但**声明类型**只能给
> `Uint8Array[]` —— 类型只看得见"下标了一次", 分不出 `uint8_t[2]` 和 `uint8_t[2][2]`。
> 运行时行为才是准的

**类型导出从 40 个压到 10 个**

- 只保留 `uint8_t`~`uint64_t`、`int8_t`~`int64_t`、`float`、`double`
- C / Windows 别名收进类型自己的 `names` 数组, 不再各导出一个实例: `char` / `uchar` /
  `short` / `ushort` / `int` / `uint` / `long` / `ulong` / `long long` / `ulong long` /
  `BYTE` / `WORD` / `DWORD` / `QWORD` / `CHAR`..`ULONGLONG` / `FLOAT` / `DOUBLE`
  改写即可, 例如 `DWORD` → `uint32_t`
- 删除 `bool` / `BOOL` / `BoolType`: 布尔字段在真实报文里是 1 / 2 / 4 字节整数, 而合法
  取值往往不止 `{0, 1}`。宽度用 `uint8_t` / `uint16_t` / `uint32_t`, 真值判断自己写。
  `BoolType` 的折算是有损的 —— `[1, 2]` 都解成 `true`(于是 `a === b` 在两种报文字节下都
  成立), 且 `encode` 只认 `0` / `1`, 原始的 `2` 编不回去, 往返即损坏; 它的
  `D extends boolean` 也表达不了三态。删除后整数类型一律保留原始取值
- **删除 `string_t` / `StringType`**: 类型该是线上的字节形状, 而"这些字节是什么字符"
  是协议属性。真实报文的编码有 UTF-8 / UTF-16LE / UTF-16BE / GBK / GB18030 / Big5 /
  Shift-JIS / codepage..., 把其中一种当默认就是在替协议做决定; 而 `string_t` 还在字节之上
  叠了**第二个**协议假设 —— 定宽字段"遇第一个 NUL 截断"。定宽字段也常见空格补位或满宽
  正文, 猜错就是静默丢数据。文本字段改用 `uint8_t[n]` / `uint8_t[ref(...)]`, 拿到 `Uint8Array`,
  编码与截断都归调用方
- 删除 `padding_t`: 它会把跳过的字节解成 uint8 数组塞进结果, 真实项目里协议表一半的字段
  是"未知/保留/填充", 让它们出现在结果里只会污染每一次消费。动态结构体请用 `skip()`
- 删除 `StructType.is()`: 唯一使用者是被删掉的 `CStruct`
- **删除 `Inject`**: 它是"任意字节级读写"的逃生舱口, 但代价是整个引擎有一处依赖**跨调用
  共享的可变 `size`**。`Inject` 的长度只有执行回调才知道, 而 `TypeField` 是全库唯一要求
  尺寸提前已知的那条路(`reserve(size)` → encode → `advance(size)`)。于是尺寸只能等 encode
  跑完再读回去 —— `StructBuffer` 恰好是 encode 之后才做 `offset += sizeof(type)`, 所以蒙对
  了; `Field` 引擎先 `reserve` 再 `advance`, 于是直接坏掉(同一个字段写出 1 字节却要读 2
  字节)。更糟的是 `sizeof(inject) === 0` 而 `size` 会残留上一次 encode 的结果, 同一个
  `Inject` 实例先 encode 短串再 encode 长串, 尺寸就串味了

  取代它的是 `delimited` —— 与 `framed` 只差"读几个": `framed` 贪婪读到缓冲区末尾(所以只能
  放在最后一个字段), `delimited` 读一个就停, 变长字段可以夹在中间。尺寸完全由 reader 推进
  `Cursor` 决定, 引擎不需要提前知道, 于是"长度只能跑起来才知道"不再是特例, 而 `size` 也
  不再是跨调用可变状态。C 字符串的写法见 README 与 `test/delimited.test.ts`
- 删除 `realloc`: 它只服务过 `Inject`(以及它之前的 py-struct), 新引擎里 `Writer` 自己管
  buffer 增长, 没有调用方了

**文本与编码不再是库的事**

本库一行编解码都没实现 —— `TextDecoder` / `TextEncoder` 全程委托平台, 所以"库里支持哪种
编码"这个问题从来不成立, 解码用平台 `TextDecoder` 就能吃下几十种 label(GBK / UTF-16LE /
Big5 / Shift-JIS ...)。因此:

- 删掉 `StructBufferConfig` 的 `textDecode` / `textEncoder`, 以及 `BlobField` 的
  `as: "text"` 形态 —— 解出来的值一律是字节
- `uint8_t[n]` / `rest()` 的 encode 入参是 `Uint8Array | number[]`, **不含 `string`**。
  这一层完全不知道手里的字节是不是文本: 库不猜编码, 也不"顺手按 UTF-8 帮你转一下" ——
  悄悄替调用方选编码, 换来的就是 GBK / UTF-16LE 报文静默错。传字符串编译期就报错, 绕过
  类型运行时也报错。文本自己 `new TextEncoder().encode(...)` / `new TextDecoder("gbk").decode(...)`,
  编码由调用方决定
- `StructType.decode` / `encode` 的第 4 个参数原本是 `textDecode`, 并用
  `!arg.decode` 这种"位置猜测"兼容两种传法。现在它是 `ctx`, 猜测逻辑删掉 —— 这是所有
  `StructType` 子类签名的一次简化
- `InferType` 里的 `IsStringy` 递归只为 `string_t` 存在(把 `string[]` 压成 `string`, 因为
  引擎下标只定字节数)。没有字符串类型之后整套逻辑连同它的深度上限一起删掉, 推导直接是
  `V` —— 顺带修掉一个隐患: 那套压平对用户自定义的 `StructType<string>` 其实是错的,
  引擎真会返回 `string[]`

**其他**

- `DynamicStructBuffer` 泛型顺序变成 `<S, D, E>`(`S` 是字段表)。类的类型参数默认值不能
  引用后声明的参数(TS2744), 而 `D` 的默认值就是 `InferDef<S>`, 想保住老的 `<D, E>` 位置
  就只能让推导失效. 需要显式指定类型时写 `new DynamicStructBuffer<any, MyType>(...)`
- 定宽字节字段不再在 NUL 处截断, 一律给满宽度。要截自己切 —— NUL 是单字节且不可能出现在
  多字节序列中间, 所以切在它上面不会劈开 UTF-8 / GBK

## 5.2.0 2022-9-28

- 📦 update packages
- ✨ add `Inject` type
- ✅✔️ add `Inject` test
- realloc


## 5.1.3 2021-10-27

- 📦 update packages

## 5.1.2 2021-9-25

- 📚 update readme

## 5.1.1 2021-9-4

- 🐛 export `bitFields` function

## 5.1.0 2021-9-3

- ✨add [bit-fields](https://docs.microsoft.com/en-us/cpp/cpp/cpp-bit-fields?view=msvc-160) type
- ✅✔️  add bit-fields test

## 5.0.0 2021-8-7

- Fix errors caused by deeps
- You can force a structure to use big-endian or little-endian
- Add more tests

## 4.7.0 2021-7-25

- Add esm module package
- No api changes

## 4.6.1 2021-2-10

- build: Upgrade dependencies, fix packaging errors, and the problem of not being able to find the TEXT function

## 4.6.0 2021-2-8

- feat: Added `TEXT()` utility function
- test: Added "utils" test code

## 4.5.0 2021-2-7

- fix: `calcsize()` Processing format byte order
- feat: Add `makeDataView()` tool function
- feat: `unpack()` function adds an optional parameter of offset
- feat: `pack_into()`,`unpack_from()`,`iter_unpack()`,`new Struct()`
- test: Added `Struct` test
- fix: Matching error when format is "2?"
- build: Upgrade all dependencies

## 4.4.1 2021-2-6

- fix: `sbytes()` Ignore case

## 4.4.0 2021-2-6

- fix: `pack()` has a bug when processing `string_t`
- feat: `sbytes2()`, `b2('abc 0x640ah') => <61 62 63 20 64 0a>`
- perf: `sbytes()` Parse multiple types of byte strings
- test: Optimize test code
- docs: Update the code sample on "readme.md"

## 4.3.0 2021-2-5

- fix: bits(...)[n], `EFLAG[2].decode(...) => [{...},{...}]`
- fix: BOOl, Before:`BOOl.decode(...) => 1`, Now: `BOOl.decode(...) => true`
- feat: bool type
- feat: padding_t type
- feat: `sbytes(...)` and `sview(...)`
- feat: [py-struct](https://docs.python.org/zh-cn/3/library/struct.html), `calcsize(...)`, `unpack(...)`, `pack(...)`

## 4.2.0 2021-1-17

- feat: `bits(...)` see readme.

## 4.1.0 2021-1-9

- When decode input array, convert to Uint8Array

## 4.0.2 2021-1-6

- fix FLOAT and DOUBLE

## 4.0.1 2021-1-5

- build "v4.0.0" 😂

## 4.0.0 2021-1-5

- fix: [#1](https://github.com/januwA/struct-buffer/issues/1)
- Support struct multi array
- Some api changes (e.g. parseCStruct => CStruct.parse, toCStruct => CStruct.from)
- Add When reading a string, it will end reading directly when it encounters 0x0, and the following bytes will be filled with 0

## 3.0.0 2020-12-25

- Support reading "c-struct" string template and converting it into StructBuffer
- Support converting StructBuffer into "c-struct" string
- Support StructBuffer list
- Added typedef function for more convenient type definition
- Added more default types
- Fixed sizeof function

## 2.0.0 2020-12-25

- Support custom type (e.g. short = registerType("short", 2, false))
- struct nesting


## 1.0.0 2020-12-24

- Add sizeof and display function
- Add type array (e.g. BYTE[3], float[4x4])
- Support array nesting (e.g. double[4][2])
- No longer supports string attributes (e.g. 'char' 'DWORD')

## 0.1.0 2020-12-23

- Add structure to ArrayBuffer
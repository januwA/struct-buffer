## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { DWORD, string_t, StructBuffer, uint32_t } from "struct-buffer";

const struct = new StructBuffer({
  hp: DWORD,
  mp: uint32_t,
  name: string_t[3],
});

// decode
const buffer = new Uint8Array([ 
  0, 0, 0, 0x0a, 
  0, 0, 0, 0x64, 
  0x61, 0x62, 0x63, 
]);
const data = struct.decode(new DataView(buffer.buffer));
expect(data.hp).toBe(0x0a);
expect(data.mp).toBe(100);
expect(data.name).toBe("abc");

// encode
const view = struct.encode({
  hp: 10,
  mp: 100,
  name: "abc",
});
expect(view.getUint32(0)).toBe(10);
expect(view.getUint32(4)).toBe(100);
expect(view.getUint8(8)).toBe(0x61); // a
expect(view.getUint8(9)).toBe(0x62); // b
expect(view.getUint8(10)).toBe(0x63); // c
```

## Use in browser
```html
<script src="struct-buffer.js"></script>
<script>
  const { DWORD, string_t, StructBuffer, uint32_t } = window.StructBuffer;
</script>
```

## Types
```ts
import {
  BYTE,
  WORD,
  DWORD,
  QWORD,

  int8_t,
  int16_t,
  int32_t,
  int64_t,

  uint8_t,
  uint16_t,
  uint32_t,
  uint64_t,

  float,
  double,

  char,
  string_t,
} from "struct-buffer";

const myStruct = {
  key: BYTE,
  key: WORD,
  key: DWORD,
  key: QWORD,

  key: int8_t,
  key: int16_t,
  key: int32_t,
  key: int64_t,

  key: uint8_t,
  key: uint16_t,
  key: uint32_t,
  key: uint64_t,

  key: float,  // size 4
  key: double, // size 8

  key: char,     // size 1
  key: "char[]", // size 1
  key: char[10], // size 10

  key: string_t,     // size 1
  key: "string_t[]", // size 1
  key: string_t[10], // size 10
};
```

## note
- Does not support multi-level arrays (e.g. DWORD[4][4x4] )

## test
> $ npm test

## build
> $ npm run build

## See also:
  - [See the test for more examples](https://github.com/januwA/struct-buffer/blob/main/test/test.test.ts)
  - [DataView](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/DataView)
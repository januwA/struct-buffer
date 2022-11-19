## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { float, string_t, StructBuffer, pack } from "struct-buffer";

const struct = new StructBuffer({
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
  const { string_t, StructBuffer, uint32_t } = window.StructBuffer;
</script>
```

## Use ["type"](https://github.com/januwA/struct-buffer/blob/main/src/types.ts) for conversion

```ts
import { uint64_t } from "struct-buffer";

// encode
const view = uint64_t[2].encode([1, 2]); 
// view => <00 00 00 01 00 00 00 02>

// decode
const data = uint64_t[2].decode(view);
// data => [ 1, 2 ]
```

## register Type
```ts
const myShort = registerType(2, false);

const struct = new StructBuffer({
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
const HANDLE = typedef(uint64_t);
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

XINPUT_GAMEPAD = new StructBuffer({
  wButtons: uint16_t,
  bLeftTrigger: uint8_t,
  bRightTrigger: uint8_t,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

XINPUT_STATE = new StructBuffer({
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
const User = new StructBuffer({
  name: string_t[2],
  name2: string_t[2],
});

const Users = new StructBuffer({
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

## "string_t" Truncate when encountering 0
```ts
string_t[4].decode(new Uint8Array([0x61, 0x62, 0x63, 0x64]); // abcd
string_t[4].decode(new Uint8Array([0x61, 0x62, 0x00, 0x64]); // ab
```

## bits
```ts
import { uint32_t, bits, StructBuffer } from "struct-buffer";

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
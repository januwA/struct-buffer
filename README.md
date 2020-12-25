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
const data = struct.decode(buffer);
// data => { hp: 10, mp: 100, name: 'abc' }

// encode
const view = struct.encode({
  hp: 10,
  mp: 100,
  name: "abc",
});
// view =>  <00 00 00 0a 00 00 00 64 61 62 63>
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
  BYTE, WORD, DWORD, QWORD,

  int8_t, int16_t, int32_t, int64_t,

  uint8_t, uint16_t, uint32_t, uint64_t,
  
  float, double, 

  char, string_t,
} from "struct-buffer";

const myStruct = {
  key: BYTE, // BYTE key;
  key: WORD, // WORD key;
  key: WORD[2], // WORD key[2];
  key: DWORD,
  key: DWORD[2],    // size 8
  key: DWORD[2][3], // size 24
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
  key: char[10], // size 10

  key: string_t,     // size 1
  key: string_t[10], // size 10
};
```

## Custom type

Use `registerType(typeName: string, size: 1 | 2 | 4 | 8, unsigned = true): StructType`

```ts
short = registerType("short", 2, false);

struct = new StructBuffer({
  hp: short,
  mp: short,
  pos: short[2],
});

// decode
data = struct.decode( new Uint8Array([0, 0x2, 0, 0xa, 0, 1, 0, 2]) );
// data => { hp: 2, mp: 10, pos: [ 1, 2 ] }

// encode
data = struct.encode({
  hp: 2,
  mp: 10,
  pos: [100, 200],
});
// data =>  <00 02 00 0a 00 64 00 c8>
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
  wButtons: WORD,
  bLeftTrigger: BYTE,
  bRightTrigger: BYTE,
  sThumbLX: int16_t,
  sThumbLY: int16_t,
  sThumbRX: int16_t,
  sThumbRY: int16_t,
});

XINPUT_STATE = new StructBuffer({
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

## test
> $ npm test

## build
> $ npm run build

## See also:
  - [See the test for more examples](https://github.com/januwA/struct-buffer/blob/main/test/test.test.ts)
  - [DataView](https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/DataView)
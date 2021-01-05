## struct-buffer

Add structure to ArrayBuffer

## Install
```
$ npm i struct-buffer
```

## how to use
```ts
import { DWORD, string_t, StructBuffer, uint32_t } from "struct-buffer";

const struct = new StructBuffer("Player",{
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

## Use ["type"](https://github.com/januwA/struct-buffer/blob/main/src/types.ts) for conversion

```ts
import { DWORD } from "struct-buffer";

// encode
const view = DWORD[2].encode([1, 2]); 
// view => <00 00 00 01 00 00 00 02>

// decode
const data = DWORD[2].decode(new Uint8Array([0, 0, 0, 1, 0, 0, 0, 2]));
// data => [ 1, 2 ]
```

## register Type
```ts
short = registerType("short", 2, false);

struct = new StructBuffer("Player", {
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
s_user = new StructBuffer("User", {
  name: string_t[2],
  name2: string_t[2],
});

s_users = new StructBuffer("Users", {
  users: s_user[2],
});

const data = s_users.decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// data.users.length => 2
// data.users[0] => { name: "a1", name2: "a2" }
// data.users[1] => { name: "b1", name2: "b2" }

// or

const users = s_user[2].decode(
  new Uint8Array([0x61, 0x31, 0x61, 0x32, 0x62, 0x31, 0x62, 0x32])
);
// users => [ { name: 'a1', name2: 'a2' }, { name: 'b1', name2: 'b2' } ]
```

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
string_t[4].decode(new Uint8Array([0x61, 0x62, 0   , 0x64]); // ab
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
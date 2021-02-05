// https://docs.python.org/zh-cn/3/library/struct.html#byte-order-size-and-alignment
// 并不完全一样

import { StructType } from "./class-type";
import { sizeof } from "./struct-buffer";
import {
  bool,
  string_t,
  padding_t,
  char,
  uchar,
  short,
  ushort,
  int,
  uint,
  long,
  ulong,
  longlong,
  ulonglong,
  float,
  double,
} from "./types";
import { createDataView, makeDataView } from "./utils";

// 没有这两个 "@", "="
const SECTION_ORDER: ReadonlyArray<string> = [">", "<", "!"];

const len_exp = /^(\d+)\w/i;

function _getTypes(format: string) {
  const next = () => {
    format = format.substr(1);
  };
  let m;
  const types: StructType<any, any>[] = [];
  while (format.length) {
    m = format.match(len_exp);
    let len = 1;
    if (m && m[1]) {
      len = parseInt(m[1]);
      format = format.substr(m[1].length);
    }

    switch (format[0]) {
      case "x":
        types.push(padding_t[len]);
        break;
      case "c":
      case "b":
        types.push(char[len]);
        break;
      case "B":
        types.push(uchar[len]);
        break;
      case "?":
        types.push(bool[len]);
        break;
      case "h":
        types.push(short[len]);
        break;
      case "H":
        types.push(ushort[len]);
        break;
      case "i":
      case "n":
        types.push(int[len]);
        break;
      case "I":
      case "N":
        types.push(uint[len]);
        break;
      case "l":
        types.push(long[len]);
        break;
      case "L":
        types.push(ulong[len]);
        break;
      case "q":
        types.push(longlong[len]);
        break;
      case "Q":
        types.push(ulonglong[len]);
        break;
      case "e":
      case "f":
        types.push(float[len]);
        break;
      case "d":
        types.push(double[len]);
        break;
      case "s":
      case "p":
        types.push(string_t[len]);
        break;
      default:
        throw new Error(`没有(${format[0]})格式!`);
    }
    next();
  }
  return types;
}

function _getLittleEndian(str: string) {
  switch (str) {
    case ">":
    case "!":
      return false;
    case "<":
      return true;
    default:
      throw new Error("错误的字节序");
  }
}

/**
 * https://docs.python.org/zh-cn/3/library/struct.html
 *
 * ```ts
 * pack("2i", -1, 2)
 * => <ff ff ff ff 00 00 00 02>
 *
 * pack(">2i", -1, 2)
 * => <ff ff ff ff 00 00 00 02>
 *
 * pack("<2i", -1, 2)
 * => <ff ff ff ff 02 00 00 00>
 *
 * pack("<b3s", 2, 'abc')
 * => <02 61 62 63>
 *
 * pack("b2xb", 2, 1)
 * => <02 00 00 01>
 * ```
 *
 */
export function pack(format: string, ...args: any[]): DataView {
  format = format.replace(/\s/g, "");

  // 获取字节序
  // https://docs.python.org/zh-cn/3/library/struct.html#byte-order-size-and-alignment
  let _sr = SECTION_ORDER[0];
  if (SECTION_ORDER.includes(format[0])) {
    _sr = format[0];
    format = format.substr(1);
  }

  const littleEndian = _getLittleEndian(_sr);
  const types = _getTypes(format);
  let length = types.reduce((acc, it) => acc + sizeof(it), 0);
  const view = createDataView(length);

  let offset = 0;

  for (const type of types) {
    if (type.is(padding_t)) {
      type.encode(0 as any, littleEndian, offset, view);
    } else {
      const obj = [];
      for (let i = 0; i < type.count; i++) obj.push(args.shift());
      type.encode(obj as any, littleEndian, offset, view);
    }

    offset += sizeof(type);
  }
  return view;
}

/**
 * https://docs.python.org/zh-cn/3/library/struct.html
 *
 * ```ts
 * unpack("2i", sbytes("ff ff ff ff 00 00 00 02"))
 * => [ -1, 2 ]
 *
 * unpack(">2i", sbytes("ff ff ff ff 00 00 00 02"))
 * => [ -1, 2 ]
 *
 * unpack("<2i", sbytes("ff ff ff ff 02 00 00 00"))
 * => [ -1, 2 ]
 *
 * unpack("b3s", sbytes("02 61 62 63"))
 * => [ 2, 'abc' ]
 *
 * unpack("b2xb", sbytes("02 00 00 01"))
 * => [ 2, 1 ]
 * ```
 *
 */
export function unpack(
  format: string,
  view: ArrayBufferView | number[]
): any[] {
  view = makeDataView(view);
  format = format.replace(/\s/g, "");

  // 获取字节序
  // https://docs.python.org/zh-cn/3/library/struct.html#byte-order-size-and-alignment
  let _sr = SECTION_ORDER[0];
  if (SECTION_ORDER.includes(format[0])) {
    _sr = format[0];
    format = format.substr(1);
  }

  const littleEndian = _getLittleEndian(_sr);
  const types = _getTypes(format);

  let offset = 0;

  const result: any[] = [];
  for (const type of types) {
    if (!type.is(padding_t)) {
      result.push(type.decode(view, littleEndian, offset));
    }
    offset += sizeof(type);
  }
  return result.flat();
}

/**
 * ```ts
 * calcsize("2i")
 * => 8
 * 
 * calcsize("hhl")
 * => 8
 * 
 * calcsize("bb3x")
 * => 5
 * ```
 * @param format 
 */
export function calcsize(format: string): number {
  format = format.replace(/\s/g, "");
  const types = _getTypes(format);
  return types.reduce((acc, it) => acc + sizeof(it), 0);
}

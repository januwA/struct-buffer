// https://docs.python.org/zh-cn/3/library/struct.html#byte-order-size-and-alignment

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

// 没有 "@", "="
const SECTION_ORDER: ReadonlyArray<string> = [">", "<", "!"];

const LEN_EXP = /^(\d+)(?=\w|\?)/i;

function _getTypes(format: string): StructType<any, any>[] {
  let m;
  const types: StructType<any, any>[] = [];
  while (format.length) {
    m = format.match(LEN_EXP);
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
    format = format.substr(1);
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

function _handleParams(format: string, buffer: ArrayBufferView | number[]) {
  format = format.replace(/\s/g, "");

  // 获取字节序
  // https://docs.python.org/zh-cn/3/library/struct.html#byte-order-size-and-alignment
  let _sr = SECTION_ORDER[0];
  if (SECTION_ORDER.includes(format[0])) {
    _sr = format[0];
    format = format.substr(1);
  }

  return {
    littleEndian: _getLittleEndian(_sr),
    view: makeDataView(buffer),
    types: _getTypes(format),
  };
}

/**
 * https://docs.python.org/zh-cn/3/library/struct.html
 *
 * ```
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
  return pack_into(format, createDataView(calcsize(format)), 0, ...args);
}

export function pack_into(
  format: string,
  buffer: ArrayBufferView | number[],
  offset: number,
  ...args: any[]
): DataView {
  const { littleEndian, types, view } = _handleParams(format, buffer);
  while (types.length) {
    const type = types.shift();
    if (!type) break;

    if (type.is(padding_t)) {
      type.encode(0 as any, littleEndian, offset, view);
    } else if (type.is(string_t)) {
      type.encode(args.shift() as any, littleEndian, offset, view);
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
 * ```
 * unpack("2i", b("ff ff ff ff 00 00 00 02"))
 * => [ -1, 2 ]
 *
 * unpack(">2i", b("ff ff ff ff 00 00 00 02"))
 * => [ -1, 2 ]
 *
 * unpack("<2i", b("ff ff ff ff 02 00 00 00"))
 * => [ -1, 2 ]
 *
 * unpack("b3s", b("02 61 62 63"))
 * => [ 2, 'abc' ]
 *
 * unpack("b2xb", b("02 00 00 01"))
 * => [ 2, 1 ]
 *
 *
 * unpack('3sbb', b('616263 640a'))
 * unpack('3sbb', b2('abc64h0ah'))
 * => [ 'abc', 100, 10 ]
 * ```
 */
export function unpack(
  format: string,
  buffer: ArrayBufferView | number[],
  offset: number = 0
): any[] {
  const { littleEndian, types, view } = _handleParams(format, buffer);
  const result: any[] = [];
  while (types.length) {
    const type = types.shift();
    if (!type) break;
    if (!type.is(padding_t))
      result.push(type.decode(view, littleEndian, offset));
    offset += sizeof(type);
  }
  return result.flat();
}

export function unpack_from(
  format: string,
  buffer: ArrayBufferView | number[],
  offset: number = 0
): any[] {
  return unpack(format, buffer, offset);
}

/**
 * ```ts
 * for (const i of iter_unpack("2b", b("01 02 03 04"))) {
 *   console.log(i); // [ 1, 2 ] -> [ 3, 4 ]
 * }
 *
 * const r = iter_unpack("2b", b("01 02 03 04"));
 * r.next().value // [1, 2]
 * r.next().value // [3, 4]
 * ```
 */
export function iter_unpack(
  format: string,
  buffer: number[] | ArrayBufferView
) {
  const size = calcsize(format);
  let offset = 0;
  return {
    next() {
      try {
        return {
          value: unpack(format, buffer, offset),
          done: !(offset += size),
        };
      } catch (error) {
        // overflow
        return { value: null, done: true };
      }
    },
    [Symbol.iterator]() {
      return this;
    },
  };
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
 */
export function calcsize(format: string): number {
  format = format.replace(/\s/g, "");
  if (SECTION_ORDER.includes(format[0])) format = format.substr(1);
  const types = _getTypes(format);
  return types.reduce((acc, it) => acc + sizeof(it), 0);
}

export class Struct {
  size: number;
  constructor(public readonly format: string) {
    this.size = calcsize(format);
  }

  pack(...args: any[]) {
    return pack_into(this.format, createDataView(this.size), 0, ...args);
  }

  pack_into(
    buffer: ArrayBufferView | number[],
    offset: number,
    ...args: any[]
  ) {
    return pack_into(this.format, buffer, offset, ...args);
  }

  unpack(buffer: ArrayBufferView | number[], offset = 0) {
    return unpack(this.format, buffer, offset);
  }

  unpack_from(buffer: ArrayBufferView | number[], offset = 0) {
    return unpack(this.format, buffer, offset);
  }

  iter_unpack(buffer: ArrayBufferView | number[]) {
    return iter_unpack(this.format, buffer);
  }
}

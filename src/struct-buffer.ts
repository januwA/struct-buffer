import { StructType } from "./class-type";
import {
  AnyObject,
  DysplayResult,
  StructOption,
  TypeHandleOptions,
} from "./interfaces";
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
  ALL_TYPE_NAMES,
} from "./types";

enum TYPE_SIZE {
  BYTE = 1,
  WORD = 2,
  DWORD = 4,
  QWORD = 8,
}

export function isStrType(type: StructType | string): type is string {
  return typeof type === "string";
}

const STRING_TYPE_EXP = /(?<type>\w+)(?<list>\[(?<size>\d+)?\])?/i;
export function parseStrType(type: string) {
  let m = type.match(STRING_TYPE_EXP);

  if (!m || !m.groups?.type)
    throw new Error(`StructBuffer: (${type}) type error.`);

  let rtype: StructType;
  const _type: string = m.groups.type.toLowerCase();

  switch (_type) {
    //========== int ===============//
    case int8_t.typeName:
      rtype = int8_t;
      break;

    case int16_t.typeName:
      rtype = int16_t;
      break;

    case int32_t.typeName:
      rtype = int32_t;
      break;

    case int64_t.typeName:
      rtype = int64_t;
      break;

    //========== uint ===============//
    case BYTE.typeName:
    case uint8_t.typeName:
      rtype = uint8_t;
      break;

    case WORD.typeName:
    case uint16_t.typeName:
      rtype = uint16_t;
      break;

    case DWORD.typeName:
    case uint32_t.typeName:
      rtype = uint32_t;
      break;

    case QWORD.typeName:
    case uint64_t.typeName:
      rtype = uint64_t;
      break;

    //========== float ===============//
    case float.typeName:
      rtype = float;
      break;

    case double.typeName:
      rtype = double;
      break;

    //========== char ===============//
    case char.typeName:
      rtype = char;
      break;

    //========== string_t ===============//
    case string_t.typeName:
      rtype = string_t;
      break;

    default:
      throw new Error(`StructBuffer: (${_type}) type does not exist.`);
  }

  const r: {
    type: StructType;
    length: number;
    isList: boolean;
  } = {
    type: rtype,
    isList: Boolean(m.groups.list),
    length: 1,
  };

  if (m.groups?.size) {
    r.length = parseInt(m.groups?.size);
  }
  return r;
}

export function typeHandle(type: StructType, options: TypeHandleOptions) {
  switch (type) {
    //========== int ===============//
    case int8_t:
      if (options[int8_t.typeName])
        options[int8_t.typeName]({
          get: "getInt8",
          set: "setInt8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case int16_t:
      if (options[int16_t.typeName])
        options[int16_t.typeName]({
          get: "getInt16",
          set: "setInt16",
          size: TYPE_SIZE.WORD,
        });
      break;

    case int32_t:
      if (options[int32_t.typeName])
        options[int32_t.typeName]({
          get: "getInt32",
          set: "setInt32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case int64_t:
      if (options[int64_t.typeName])
        options[int64_t.typeName]({
          get: "getBigInt64",
          set: "setBigInt64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    //========== uint ===============//
    case BYTE:
      if (options[BYTE.typeName])
        options[BYTE.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;
    case uint8_t:
      if (options[uint8_t.typeName])
        options[uint8_t.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case WORD:
      if (options[WORD.typeName])
        options[WORD.typeName]({
          get: "getUint16",
          set: "setUint16",
          size: TYPE_SIZE.WORD,
        });
      break;
    case uint16_t:
      if (options[uint16_t.typeName])
        options[uint16_t.typeName]({
          get: "getUint16",
          set: "setUint16",
          size: TYPE_SIZE.WORD,
        });
      break;

    case DWORD:
      if (options[DWORD.typeName])
        options[DWORD.typeName]({
          get: "getUint32",
          set: "setUint32",
          size: TYPE_SIZE.DWORD,
        });
      break;
    case uint32_t:
      if (options[uint32_t.typeName])
        options[uint32_t.typeName]({
          get: "getUint32",
          set: "setUint32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case QWORD:
      if (options[QWORD.typeName])
        options[QWORD.typeName]({
          get: "getBigUint64",
          set: "setBigUint64",
          size: TYPE_SIZE.QWORD,
        });
      break;
    case uint64_t:
      if (options[uint64_t.typeName])
        options[uint64_t.typeName]({
          get: "getBigUint64",
          set: "setBigUint64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    //========== float ===============//
    case float:
      if (options[float.typeName])
        options[float.typeName]({
          get: "getFloat32",
          set: "setFloat32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case double:
      if (options[double.typeName])
        options[double.typeName]({
          get: "getFloat64",
          set: "setFloat64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    case char:
      if (options[char.typeName])
        options[char.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case string_t:
      if (options[string_t.typeName])
        options[string_t.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;
  }
}

/**
 * ```js
 * sizeof(string_t) // 1
 * sizeof(string_t[10]) // 10
 *
 * sizeof(char) // 1
 * sizeof(char[10]) // 1
 *
 * sizeof(DWORD) // 4
 * sizeof(DWORD[4]) // 16
 * ```
 * @param type
 */
export function sizeof(type: StructType | string): number {
  let r = 0;
  let length = 1;
  if (isStrType(type)) {
    const p = parseStrType(type);
    type = p.type;
    length = p.length;
  }

  const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>((acc, typeName) => {
    acc[typeName] = (opt) => (r = opt.size);
    return acc;
  }, {});

  typeHandle(type, handle);
  return r * length;
}

export function display(
  view: DataView,
  type: StructType,
  isHex: boolean = true,
  littleEndian: boolean = false
): DysplayResult[] {
  let offset = 0;

  function _d(m: string, size: number) {
    let r = [];
    while (true) {
      try {
        let value = (view as any)[m](offset, littleEndian);

        if (isHex && type !== float && type !== double) {
          value = value
            .toString(16)
            .toUpperCase()
            .padStart(size * 2, "0");
        }
        r.push({
          offset,
          value,
        });
        offset += size;
      } catch (error) {
        break; // 直到溢出为止
      }
    }
    return r;
  }

  let result: DysplayResult[] | null = null;

  const handle = ALL_TYPE_NAMES.filter((typeName) => {
    // 不处理char和string_t
    return typeName !== char.typeName || typeName !== string_t.typeName;
  }).reduce<TypeHandleOptions>((acc, typeName) => {
    acc[typeName] = (opt) => (result = _d(opt.get, opt.size));
    return acc;
  }, {});

  typeHandle(type, handle);

  if (!result) {
    throw new Error(`StructBuffer: display does not support (${type}) type.`);
  }

  return result;
}

export class StructBuffer {
  private _textDecode = new TextDecoder();
  get textDecode() {
    return this._textDecode;
  }
  set textDecode(value) {
    this._textDecode = value;
  }
  private _decode(input?: ArrayBufferView | ArrayBuffer) {
    return this.textDecode.decode(input);
  }

  private _textEncoder = new TextEncoder();
  get textEncoder() {
    return this._textEncoder;
  }
  set textEncoder(value) {
    this._textEncoder = value;
  }
  private _encode(input?: string) {
    return this.textEncoder.encode(input);
  }

  constructor(private readonly struct: StructOption) {}

  private _offset = 0;

  get byteLength(): number {
    let count = 0;
    for (const key in this.struct) {
      const type = this.struct[key];
      count += sizeof(type);
    }
    return count;
  }

  decode(view: DataView, littleEndian: boolean = false): AnyObject {
    const r: AnyObject = {};
    for (const key in this.struct) {
      let type: StructType | string = this.struct[key];
      let length = 1;
      let isList = false;

      if (isStrType(type)) {
        const p = parseStrType(type);
        type = p.type;
        length = p.length;
        isList = p.isList;
      }

      const _readValue = this._readValue.bind(
        this,
        view,
        isList,
        length,
        littleEndian
      );

      const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>(
        (acc, typeName) => {
          acc[typeName] = (opt) => {
            if (typeName === char.typeName || typeName === string_t.typeName) {
              if (isList) {
                r[key] = this._readBytes(view, length);
                if (type === string_t) {
                  r[key] = this._decode(new Uint8Array(r[key]));
                }
              } else {
                r[key] = view.getUint8(this._offset);
                if (type === string_t)
                  r[key] = this._decode(new Uint8Array([r[key]]));

                this._offset += TYPE_SIZE.BYTE;
              }
            } else {
              r[key] = _readValue(opt.get, opt.size);
            }
          };

          return acc;
        },
        {}
      );

      typeHandle(type, handle);
    }
    this._offset = 0;
    return r;
  }

  encode(obj: AnyObject, littleEndian: boolean = false): DataView {
    const view = new DataView(new ArrayBuffer(this.byteLength));

    for (const key in this.struct) {
      let type: StructType | string = this.struct[key];
      let length = 1;
      let isList = false;

      if (isStrType(type)) {
        const p = parseStrType(type);
        type = p.type;
        length = p.length;
        isList = p.isList;
      }

      const value = obj[key];

      const _writeValue = this._writeValue.bind(
        this,
        view,
        isList,
        length,
        littleEndian,
        value
      );

      const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>(
        (acc, typeName) => {
          acc[typeName] = (opt) => {
            if (typeName === char.typeName || typeName === string_t.typeName) {
              if (isList) {
                this._writeBytes(
                  view,
                  type === char ? value : this._encode(value.toString()),
                  length
                );
              } else {
                this._writeBytes(
                  view,
                  type === char ? [value] : this._encode(value.toString()),
                  TYPE_SIZE.BYTE
                );
              }
            } else {
              _writeValue(opt.set, opt.size);
            }
          };
          return acc;
        },
        {}
      );

      typeHandle(type, handle);
    }
    this._offset = 0;
    return view;
  }

  private _readBytes(view: DataView, size: number) {
    const bytes: number[] = [];
    for (let i = 0; i < size; i++) {
      bytes.push(view.getUint8(this._offset));
      this._offset++;
    }
    return bytes;
  }

  private _writeBytes(
    view: DataView,
    bytes: number[] | Uint8Array,
    size: number
  ) {
    for (let i = 0; i < size; i++) {
      let it = bytes[i];
      if (it === undefined) it = 0; // 填充0
      view.setUint8(this._offset, it);
      this._offset++;
    }
  }

  private _readValue(
    view: DataView,
    isList: boolean,
    length: number,
    littleEndian: boolean,
    m: string,
    size: number
  ): number | number[] {
    let r;
    if (isList) {
      r = [];
      for (let i = 0; i < length; i++) {
        r.push((view as any)[m](this._offset, littleEndian));
        this._offset += size;
      }
    } else {
      r = (view as any)[m](this._offset, littleEndian);
      this._offset += size;
    }
    return r;
  }

  private _writeValue(
    view: DataView,
    isList: boolean,
    length: number,
    littleEndian: boolean,
    value: any,
    m: string,
    size: number
  ): void {
    if (isList) {
      for (let i = 0; i < length; i++) {
        (view as any)[m](this._offset, value[i], littleEndian);
        this._offset += size;
      }
    } else {
      (view as any)[m](this._offset, value, littleEndian);
      this._offset += size;
    }
  }
}

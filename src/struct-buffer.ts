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

/**
 * 设置数组嵌套层数
 * @param array
 * @param deeps
 * @param isString
 */
function unflattenDeep(
  array: any[] | string,
  deeps: number[],
  isString = false
) {
  let r: any = array;

  if (isString && typeof r === "string") r = (r as any).split("");

  for (let i = deeps.length - 1; i >= 1; i--) {
    const isFirst = i === deeps.length - 1;
    const value = deeps[i];
    r = r.reduce((acc: any, it: any, index: number) => {
      if (index % value === 0) acc.push([]);
      acc[acc.length - 1].push(it);
      return acc;
    }, []);

    if (isString && isFirst) {
      r = r.map((it: any) => it.join(""));
    }
  }
  return r;
}

export function typeHandle(type: StructType, options: TypeHandleOptions) {
  switch (type.typeName) {
    //========== int ===============//
    case int8_t.typeName:
      if (options[int8_t.typeName])
        options[int8_t.typeName]({
          get: "getInt8",
          set: "setInt8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case int16_t.typeName:
      if (options[int16_t.typeName])
        options[int16_t.typeName]({
          get: "getInt16",
          set: "setInt16",
          size: TYPE_SIZE.WORD,
        });
      break;

    case int32_t.typeName:
      if (options[int32_t.typeName])
        options[int32_t.typeName]({
          get: "getInt32",
          set: "setInt32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case int64_t.typeName:
      if (options[int64_t.typeName])
        options[int64_t.typeName]({
          get: "getBigInt64",
          set: "setBigInt64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    //========== uint ===============//
    case BYTE.typeName:
      if (options[BYTE.typeName])
        options[BYTE.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;
    case uint8_t.typeName:
      if (options[uint8_t.typeName])
        options[uint8_t.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case WORD.typeName:
      if (options[WORD.typeName])
        options[WORD.typeName]({
          get: "getUint16",
          set: "setUint16",
          size: TYPE_SIZE.WORD,
        });
      break;
    case uint16_t.typeName:
      if (options[uint16_t.typeName])
        options[uint16_t.typeName]({
          get: "getUint16",
          set: "setUint16",
          size: TYPE_SIZE.WORD,
        });
      break;

    case DWORD.typeName:
      if (options[DWORD.typeName])
        options[DWORD.typeName]({
          get: "getUint32",
          set: "setUint32",
          size: TYPE_SIZE.DWORD,
        });
      break;
    case uint32_t.typeName:
      if (options[uint32_t.typeName])
        options[uint32_t.typeName]({
          get: "getUint32",
          set: "setUint32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case QWORD.typeName:
      if (options[QWORD.typeName])
        options[QWORD.typeName]({
          get: "getBigUint64",
          set: "setBigUint64",
          size: TYPE_SIZE.QWORD,
        });
      break;
    case uint64_t.typeName:
      if (options[uint64_t.typeName])
        options[uint64_t.typeName]({
          get: "getBigUint64",
          set: "setBigUint64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    //========== float ===============//
    case float.typeName:
      if (options[float.typeName])
        options[float.typeName]({
          get: "getFloat32",
          set: "setFloat32",
          size: TYPE_SIZE.DWORD,
        });
      break;

    case double.typeName:
      if (options[double.typeName])
        options[double.typeName]({
          get: "getFloat64",
          set: "setFloat64",
          size: TYPE_SIZE.QWORD,
        });
      break;

    case char.typeName:
      if (options[char.typeName])
        options[char.typeName]({
          get: "getUint8",
          set: "setUint8",
          size: TYPE_SIZE.BYTE,
        });
      break;

    case string_t.typeName:
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
export function sizeof(type: StructType): number {
  let typeSize = 0;
  const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>((acc, typeName) => {
    acc[typeName] = (opt) => (typeSize = opt.size);
    return acc;
  }, {});

  typeHandle(type, handle);
  if (type.isList) return typeSize * type.count;
  return typeSize;
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
      const type: StructType = this.struct[key];
      const _readValue = this._readValue.bind(this, view, type, littleEndian);

      const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>(
        (acc, typeName) => {
          acc[typeName] = (opt) => {
            if (typeName === char.typeName || typeName === string_t.typeName) {
              r[key] = this._readBytes(view, type);
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
      let type: StructType = this.struct[key];
      const value = obj[key];

      const _writeValue = this._writeValue.bind(
        this,
        view,
        type,
        littleEndian,
        value
      );

      const handle = ALL_TYPE_NAMES.reduce<TypeHandleOptions>(
        (acc, typeName) => {
          acc[typeName] = (opt) => {
            if (typeName === char.typeName || typeName === string_t.typeName) {
              this._writeBytes(view, type, value);
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

  private _readBytes(view: DataView, type: StructType) {
    let r;
    const isString = type.typeName === string_t.typeName;
    if (type.isList) {
      r = [];
      for (let i = 0; i < type.count; i++) {
        r.push(view.getUint8(this._offset));
        this._offset++;
      }

      if (isString) {
        r = this._decode(new Uint8Array(r));

        // string_t[3] => 'abc'
        if (type.deeps.length < 2) return r;
      }

      r = unflattenDeep(r, type.deeps, isString);
      return r;
    } else {
      r = view.getUint8(this._offset);
      if (isString) {
        r = this._decode(new Uint8Array([r]));
      }
      this._offset++;
      return r;
    }
  }

  private _writeBytes(view: DataView, type: StructType, value: any) {
    const isString = type.typeName === string_t.typeName;
    if (type.isList) {
      // string_t[10] 可以是非数组
      if (Array.isArray(value)) {
        value = value.flat();

        // string[]
        if (isString) value = value.join("");
      }

      // string
      if (isString) value = this._encode(value);

      for (let i = 0; i < type.count; i++) {
        let it = value[i];
        if (it === undefined) it = 0; // 填充0
        view.setUint8(this._offset, it);
        this._offset++;
      }
    } else {
      if (isString) {
        value = this._encode(value)[0];
      }
      view.setUint8(this._offset, value);
      this._offset++;
    }
  }

  private _readValue(
    view: DataView,
    type: StructType,
    littleEndian: boolean,
    m: string,
    size: number
  ): number | number[] {
    let r;
    if (type.isList) {
      r = [];
      for (let i = 0; i < type.count; i++) {
        r.push((view as any)[m](this._offset, littleEndian));
        this._offset += size;
      }
      r = unflattenDeep(r, type.deeps);
    } else {
      r = (view as any)[m](this._offset, littleEndian);
      this._offset += size;
    }
    return r;
  }

  private _writeValue(
    view: DataView,
    type: StructType,
    littleEndian: boolean,
    value: any,
    m: string,
    size: number
  ): void {
    if (type.isList && Array.isArray(value)) {
      value = value.flat();
      for (let i = 0; i < type.count; i++) {
        (view as any)[m](this._offset, value[i], littleEndian);
        this._offset += size;
      }
    } else {
      (view as any)[m](this._offset, value, littleEndian);
      this._offset += size;
    }
  }
}

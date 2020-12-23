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
  Char,
  String_t,
} from "./types";

export interface AnyObject {
  [key: string]: any;
}

export interface StructOption {
  [k: string]: string;
}

enum TYPE_SIZE {
  BYTE = 1,
  WORD = 2,
  DWORD = 4,
  QWORD = 8,
}

export class StructBuffer {
  private _textDecode = new TextDecoder();
  get textDecode() {
    return this._textDecode;
  }
  set textDecode(value) {
    this._textDecode = value;
  }

  private _textEncoder = new TextEncoder();
  get textEncoder() {
    return this._textEncoder;
  }
  set textEncoder(value) {
    this._textEncoder = value;
  }

  constructor(private readonly struct: StructOption) {}

  private _offset = 0;

  get byteLength(): number {
    let r = 0;
    for (const key in this.struct) {
      const type = this.struct[key];
      switch (type) {
        //========== int ===============//
        case int8_t:
          r += TYPE_SIZE.BYTE;
          break;

        case int16_t:
          r += TYPE_SIZE.WORD;
          break;

        case int32_t:
          r += TYPE_SIZE.DWORD;
          break;

        case int64_t:
          r += TYPE_SIZE.DWORD;
          break;

        //========== uint ===============//
        case BYTE:
        case uint8_t:
          r += TYPE_SIZE.BYTE;
          break;

        case WORD:
        case uint16_t:
          r += TYPE_SIZE.WORD;
          break;

        case DWORD:
        case uint32_t:
          r += TYPE_SIZE.DWORD;
          break;

        case QWORD:
        case uint64_t:
          r += TYPE_SIZE.QWORD;
          break;

        //========== float ===============//
        case float:
          r += TYPE_SIZE.DWORD;
          break;

        case double:
          r += TYPE_SIZE.DWORD;
          break;

        default:
          if (typeof type === "string") {
            let m = type.match(/(?<type>\w+)\[(?<size>\d+)?\]/i);
            if (m && m.groups?.type) {
              if (m.groups?.size) {
                r += parseInt(m.groups.size);
              } else {
                r += TYPE_SIZE.BYTE;
              }
            }
          }

          // char
          if ((type as any) instanceof Char) {
            r += TYPE_SIZE.BYTE;
          }

          // string_t
          if ((type as any) instanceof String_t) {
            r += TYPE_SIZE.BYTE;
          }
          break;
      }
    }
    return r;
  }

  decode(view: DataView, littleEndian: boolean = false): AnyObject {
    const r: any = {};
    for (const key in this.struct) {
      const type: any = this.struct[key];
      let size = 0;
      switch (type) {
        //========== int ===============//
        case int8_t:
          size = TYPE_SIZE.BYTE;
          r[key] = view.getInt8(this._offset);
          break;

        case int16_t:
          size = TYPE_SIZE.WORD;
          r[key] = view.getInt16(this._offset, littleEndian);
          break;

        case int32_t:
          size = TYPE_SIZE.DWORD;
          r[key] = view.getInt32(this._offset, littleEndian);
          break;

        case int64_t:
          size = TYPE_SIZE.DWORD;
          r[key] = view.getBigInt64(this._offset, littleEndian);
          break;

        //========== uint ===============//
        case BYTE:
        case uint8_t:
          size = TYPE_SIZE.BYTE;
          r[key] = view.getUint8(this._offset);
          break;

        case WORD:
        case uint16_t:
          size = TYPE_SIZE.WORD;
          r[key] = view.getUint16(this._offset, littleEndian);
          break;

        case DWORD:
        case uint32_t:
          size = TYPE_SIZE.DWORD;
          r[key] = view.getUint32(this._offset, littleEndian);
          break;

        case QWORD:
        case uint64_t:
          size = TYPE_SIZE.QWORD;
          r[key] = view.getBigUint64(this._offset, littleEndian);
          break;

        //========== float ===============//
        case float:
          size = TYPE_SIZE.DWORD;
          r[key] = view.getFloat32(this._offset, littleEndian);
          break;

        case double:
          size = TYPE_SIZE.DWORD;
          r[key] = view.getFloat64(this._offset, littleEndian);
          break;

        default:
          if (typeof type === "string") {
            let m = type.match(/(?<type>\w+)\[(?<size>\d+)?\]/i);
            if (m && m.groups?.type) {
              // char[] or char[10]
              if (m.groups?.type.toLowerCase() === "char") {
                if (m.groups?.size) {
                  // char[10]
                  const dataSize = parseInt(m.groups!.size);
                  r[key] = this._readBytes(view, dataSize);
                } else {
                  // char[]
                  size = TYPE_SIZE.BYTE;
                  r[key] = view.getUint8(this._offset);
                }
              }

              // string_t[] or string_t[10]
              if (m.groups?.type.toLowerCase() === "string_t") {
                if (m.groups?.size) {
                  // string_t[10]
                  const dataSize = parseInt(m.groups!.size);
                  r[key] = this._readBytes(view, dataSize);
                  r[key] = this.textDecode.decode(new Uint8Array(r[key]));
                } else {
                  // string_t[]
                  size = TYPE_SIZE.BYTE;
                  r[key] = view.getUint8(this._offset);
                  r[key] = this.textDecode.decode(new Uint8Array([r[key]]));
                }
              }
            }
          }

          // char
          if ((type as any) instanceof Char) {
            size = TYPE_SIZE.BYTE;
            r[key] = view.getUint8(this._offset);
          }

          // string_t
          if ((type as any) instanceof String_t) {
            size = TYPE_SIZE.BYTE;
            r[key] = view.getUint8(this._offset);
            r[key] = this.textDecode.decode(new Uint8Array([r[key]]));
          }
          break;
      }
      this._offset += size;
    }
    this._offset = 0;
    return r;
  }

  encode(obj: AnyObject, littleEndian: boolean = false) {
    const view = new DataView(new ArrayBuffer(this.byteLength));

    for (const key in this.struct) {
      const type: any = this.struct[key];
      const value = obj[key];
      let size = 0;
      switch (type) {
        //========== int ===============//
        case int8_t:
          size = TYPE_SIZE.BYTE;
          view.setInt8(this._offset, value);
          break;

        case int16_t:
          size = TYPE_SIZE.WORD;
          view.setInt16(this._offset, value, littleEndian);
          break;

        case int32_t:
          size = TYPE_SIZE.DWORD;
          view.setInt32(this._offset, value, littleEndian);
          break;

        case int64_t:
          size = TYPE_SIZE.DWORD;
          view.setBigInt64(this._offset, value, littleEndian);
          break;

        //========== uint ===============//
        case BYTE:
        case uint8_t:
          size = TYPE_SIZE.BYTE;
          view.setUint8(this._offset, value);
          break;

        case WORD:
        case uint16_t:
          size = TYPE_SIZE.WORD;
          view.setUint16(this._offset, value, littleEndian);
          break;

        case DWORD:
        case uint32_t:
          size = TYPE_SIZE.DWORD;
          view.setUint32(this._offset, value, littleEndian);
          break;

        case QWORD:
        case uint64_t:
          size = TYPE_SIZE.QWORD;
          view.setBigUint64(this._offset, value, littleEndian);
          break;

        //========== float ===============//
        case float:
          size = TYPE_SIZE.DWORD;
          view.setFloat32(this._offset, value, littleEndian);
          break;

        case double:
          size = TYPE_SIZE.DWORD;
          view.setFloat64(this._offset, value, littleEndian);
          break;

        default:
          if (typeof type === "string") {
            let m = type.match(/(?<type>\w+)\[(?<size>\d+)?\]/i);
            if (m && m.groups?.type) {
              // char[] or char[10]
              if (m.groups?.type.toLowerCase() === "char") {
                if (m.groups?.size) {
                  // char[10]
                  const dataSize = parseInt(m.groups!.size);
                  this._writeBytes(view, value, dataSize);
                } else {
                  // char[]
                  size = TYPE_SIZE.BYTE;
                  if (Array.isArray(value)) {
                    view.setUint8(this._offset, value[0]);
                  } else {
                    view.setUint8(this._offset, value);
                  }
                }
              }

              // string_t[] or string_t[10]
              if (
                (m.groups?.type.toLowerCase() === "string_t" &&
                  typeof value === "string") ||
                value instanceof String
              ) {
                if (m.groups?.size) {
                  // string_t[10]
                  const dataSize = parseInt(m.groups!.size);
                  this._writeBytes(
                    view,
                    this.textEncoder.encode(value.toString()),
                    dataSize
                  );
                } else {
                  // string_t[]
                  size = TYPE_SIZE.BYTE;
                  this._writeBytes(
                    view,
                    this.textEncoder.encode(value.toString()),
                    TYPE_SIZE.BYTE
                  );
                }
              }
            }
          }

          // char
          if ((type as any) instanceof Char) {
            size = TYPE_SIZE.BYTE;
            if (Array.isArray(value)) {
              view.setUint8(this._offset, value[0]);
            } else {
              view.setUint8(this._offset, value);
            }
          }

          // string_t
          if ((type as any) instanceof String_t) {
            size = TYPE_SIZE.BYTE;
            this._writeBytes(
              view,
              this.textEncoder.encode(value[0]),
              TYPE_SIZE.BYTE
            );
          }
          break;
      }
      this._offset += size;
    }
    this._offset = 0;
    return view;
  }

  private _readBytes(view: DataView, size: number) {
    const r = [];
    for (let i = 0; i < size; i++) {
      r.push(view.getUint8(this._offset));
      this._offset++;
    }
    return r;
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
}
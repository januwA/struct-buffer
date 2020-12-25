import { StructType } from "./class-type";
import { AnyObject, DysplayResult } from "./interfaces";
import { float, double, string_t } from "./types";

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
export function sizeof(type: StructType | StructBuffer): number {
  if (type instanceof StructBuffer) return type.byteLength;
  return type.isList ? type.size * type.count : type.size;
}

export function display(
  view: DataView,
  type: StructType,
  isHex: boolean = true,
  littleEndian: boolean = false
): DysplayResult[] {
  let offset = 0;
  const result: DysplayResult[] = [];

  while (true) {
    try {
      let value = (view as any)[type.get](offset, littleEndian);

      if (isHex && !float.is(type) && !double.is(type)) {
        value = value
          .toString(16)
          .toUpperCase()
          .padStart(type.size * 2, "0");
      }
      result.push({
        offset,
        value,
      });
      offset += type.size;
    } catch (error) {
      break; // 直到溢出为止
    }
  }

  return result;
}

export class StructBuffer {
  constructor(
    private readonly struct: {
      [k: string]: StructType | StructBuffer;
    }
  ) {}

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

  get byteLength(): number {
    return Object.values(this.struct).reduce(
      (acc, type) => (acc += sizeof(type)),
      0
    );
  }

  decode(
    view: ArrayBufferView,
    littleEndian: boolean = false,
    offset: number = 0
  ): AnyObject {
    if (!(view instanceof DataView)) {
      view = new DataView(view.buffer);
    }

    const result = Object.entries(this.struct).reduce<AnyObject>(
      (acc, [key, type]) => {
        if (type instanceof StructBuffer) {
          acc[key] = type.decode(view, littleEndian, offset);
          offset += type.byteLength;
        } else {
          let value;
          const isString = string_t.is(type);
          if (type.isList) {
            value = [];
            for (let i = 0; i < type.count; i++) {
              const it = (view as any)[type.get](offset, littleEndian);
              value.push(it);
              offset += type.size;
            }

            if (isString) {
              value = this._decode(new Uint8Array(value));
              // string_t[3] => 'abc'
              if (type.deeps.length < 2) {
                acc[key] = value;
                return acc;
              }
            }
            value = unflattenDeep(value, type.deeps, isString);
          } else {
            value = (view as any)[type.get](offset, littleEndian);
            if (isString) value = this._decode(new Uint8Array([value]));
            offset += type.size;
          }
          acc[key] = value;
        }
        return acc;
      },
      {}
    );
    return result;
  }

  encode(
    obj: AnyObject,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView
  ): DataView {
    const v = view ? view : new DataView(new ArrayBuffer(this.byteLength));
    const result = Object.entries(this.struct).reduce<DataView>(
      (acc: DataView, [key, type]) => {
        let value = obj[key];
        if (type instanceof StructBuffer) {
          type.encode(value, littleEndian, offset, acc);
          offset += type.byteLength;
        } else {
          const isString = string_t.is(type);

          if (type.isList) {
            // string_t[2]    => 'ab'
            // string_t[2][2] => [['ab'], ['cd']]
            // float[2]       => [1.2, 3.1]
            if (Array.isArray(value)) {
              value = value.flat();
              if (isString) value = value.join("");
            }

            // string
            if (isString) value = this._encode(value);

            for (let i = 0; i < type.count; i++) {
              const it = value[i] ?? 0; // 填充0
              (acc as any)[type.set](offset, it, littleEndian);
              offset += type.size;
            }
          } else {
            if (isString) value = this._encode(value)[0];
            (acc as any)[type.set](offset, value, littleEndian);
            offset += type.size;
          }
        }
        return acc;
      },
      v
    );
    return result;
  }
}

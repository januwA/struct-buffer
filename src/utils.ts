import { DecodeBuffer_t, ITextDecoder, ITextEncoder } from "./interfaces";

export function zeroMemory(view: DataView, length: number, offset: number) {
  while (length-- > 0) view.setUint8(offset++, 0);
}

/**
 * ```ts
 * createDataView(3)
 * => <00 00 00>
 * ```
 * @param byteLength
 * @param view
 */
export function createDataView(byteLength: number, view?: DataView) {
  return view ? view : new DataView(new ArrayBuffer(byteLength));
}

/**
 * ```ts
 * makeDataView([1,2,3])
 * => <01 02 03>
 * ```
 * @param view
 */
export function makeDataView(view: DecodeBuffer_t): DataView {
  if (view instanceof DataView) return view;
  if (Array.isArray(view)) view = Uint8Array.from(view);
  if (!ArrayBuffer.isView(view))
    throw new Error(`Type Error: (${view}) is not an ArrayBuffer!!!`);
  // 必须带上 byteOffset/byteLength: `buf.subarray(4, 14)` 之类是**窗口**而不是整块
  // buffer, 只取 .buffer 会越界读到窗口之外, 非零 byteOffset 时更是从错误的位置开读.
  return new DataView(view.buffer, view.byteOffset, view.byteLength);
}

/**
 * ```
 * b('61 62 63 64 0a')
 *
 * b('616263640a')
 * b('0x610x620x630x640x0a')
 * b('0x61 0x62 0x63 0x64 0x0a')
 * b('616263 640a')
 *
 * // => <61 62 63 64 0a>
 * ```
 */
export function sbytes(str: string): DataView {
  str = str.replace(/0x|h|\\x|\s/gi, "");
  if (str.length % 2 !== 0) str = str.slice(0, -1);
  str = str.replace(/([0-9a-f]{2})(?=[0-9a-f])/gi, "$1 ");
  return new DataView(
    Uint8Array.from(str.split(/\s+/).map((it) => parseInt(it, 16))).buffer
  );
}

const HEX_EXP = /^(0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2}))/i;
const HEX_SEARCH_EXP = /0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2})/i;

/**
 * ```ts
 * b2('abc 0x640x0a')
 * b2('abc 0x640ah')
 * b2('abc \\x640ah')
 * // => <61 62 63 20 64 0a>
 * ```
 *
 * `encoder` 只在遇到非十六进制文本时才会用到, 由调用方按运行时提供
 * (例如浏览器/Node 的 `new TextEncoder()`)。纯十六进制串不需要它。
 */
export function sbytes2(str: string, encoder?: ITextEncoder): DataView {
  let m;
  const bytes = [];
  while (str.length) {
    m = str.match(HEX_EXP);
    if (m && m[1]) {
      const v = m[2] ?? m[3] ?? m[4] ?? 0;
      bytes.push(parseInt(v, 16));
      str = str.substr(m[1].length);
    } else if (str.length) {
      if (!encoder)
        throw new Error(
          "sbytes2: 输入含非十六进制文本, 请传入文本编码器 (如 new TextEncoder())"
        );
      const i = str.search(HEX_SEARCH_EXP);
      if (i < 0) {
        // all string
        bytes.push(...encoder.encode(str));
        str = "";
      } else {
        const s = str.substr(0, i);
        bytes.push(...encoder.encode(s));
        str = str.substr(i);
      }
    }
  }

  return new DataView(Uint8Array.from(bytes).buffer);
}

/**
 *
 * ArrayBufferView or number[] to string
 * ```ts
 * sview([2, 0, 0, 1])
 * // => 02 00 00 01
 *
 * sview(new Uint8Array([0, 1, 10]))
 * // => 00 01 0a
 *
 * sview(b2('abc01h2h3h'))
 * // => 61 62 63 01 02 03
 * ```
 */
export function sview(view: DecodeBuffer_t): string {
  const v = makeDataView(view);
  const lst = [];
  for (let i = 0; i < v.byteLength; i++) {
    lst.push(v.getUint8(i).toString(16).padStart(2, "0"));
  }
  return lst.join(" ");
}

/**
 * ```ts
 * const view = makeDataView([
 *   0x61, 0x62, 0x63, 0x01, 0x02, 0x78, 0x79, 0x7a, 0, 0, 0, 8, 0, 0, 0, 9,
 * ]);
 * TEXT(view, new TextDecoder())
 * // => "abc..xyz........"
 *
 * TEXT(view, new TextDecoder(), "^")
 * // => "abc^^xyz^^^^^^^^"
 * ```
 *
 * `decoder` 由调用方按运行时提供 (例如 `new TextDecoder()`), 库不内置任何实现。
 */
export function TEXT(
  buf: number[] | ArrayBufferView,
  decoder: ITextDecoder,
  placeholder?: ((byte: number) => string) | string
): string {
  const view = makeDataView(buf);
  let offset = 0;
  let str = "";
  let strBytes = [];
  while (true) {
    try {
      const byte = view.getUint8(offset++);
      if (byte >= 0x20) {
        strBytes.push(byte);
      } else {
        if (strBytes.length) {
          str += decoder.decode(Uint8Array.from(strBytes));
          strBytes = [];
        }
        str += placeholder
          ? typeof placeholder === "string"
            ? placeholder
            : placeholder(byte)
          : ".";
      }
    } catch {
      if (strBytes.length) str += decoder.decode(Uint8Array.from(strBytes));
      break;
    }
  }
  return str;
}

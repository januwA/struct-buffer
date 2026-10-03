import { DecodeBuffer_t, Type } from "./interfaces";

/**
 * 设置数组嵌套层数
 * @param array
 * @param deeps
 * @param isString
 */
export function unflattenDeep(
  array: any[] | string,
  deeps: (number | any)[],
  isString = false
) {
  let r: any = array;

  if (isString && typeof r === "string") r = (r as any).split("");

  for (let i = deeps.length - 1; i >= 1; i--) {
    const isFirst = i === deeps.length - 1;
    const value = isRef(deeps[i]) ? deeps[i].resolve(undefined) : Number(deeps[i]);
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
  // buffer, 只取 .buffer 会越界读到窗口之外(FramedField 会在尾部凭空多解一个子帧),
  // 非零 byteOffset 时更是从错误的位置开读.
  return new DataView(view.buffer, view.byteOffset, view.byteLength);
}

let refSeq = 0;

// `ref()` 返回的 Ref 被当作下标用时, JS 只把它的 `Symbol.toPrimitive` 字符串交给代理,
// 对象本身已经丢了 —— 只能靠这张表把 transform 找回来. 用 WeakRef 存值 +
// FinalizationRegistry 删键: schema 被回收后条目随之消失. 旧实现是强引用 Map,
// 动态建表的场景只增不减. 老运行时没有这两个 API 就退回强引用, 行为与旧版一致.
interface RefSlot {
  deref(): Ref | undefined;
}
const REF_MAP = new Map<string, RefSlot>();
const REF_FINALIZER: { register(target: object, held: string): void } | undefined =
  typeof (globalThis as any).WeakRef === "function" &&
  typeof (globalThis as any).FinalizationRegistry === "function"
    ? new (globalThis as any).FinalizationRegistry((id: string) => {
        REF_MAP.delete(id);
      })
    : undefined;

/**
 * 元素个数通道. Field 引擎解析完 `ref("n")` 后把结果挂到 ctx 的这个 symbol 键上,
 * `StructType.getCount` 优先读它.
 *
 * 用 symbol 而不是 `ctx.__count` 字符串键: ctx 就是正在解析的那条记录本身, 字符串键
 * 会和用户真叫 `__count` 的字段撞名, 而撞名的后果是长度解析成完全无关的数字 ——
 * 这类静默错误比崩溃难查得多.
 */
export const COUNT: unique symbol = Symbol.for(
  "struct-buffer.element-count"
) as any;

/** 给 ctx 附上显式元素数(不改动原对象); ctx 为空时只带 count */
export function withCount(ctx: any, count: number): any {
  if (ctx == null) return { [COUNT]: count };
  if (ctx[COUNT] === count) return ctx;
  // 多数字段没有 ref, 不必付出一次浅拷贝的代价
  const out = Object.create(ctx);
  out[COUNT] = count;
  return out;
}

export class Ref {
  readonly __isRef = true;
  readonly id: string;

  constructor(
    public readonly field: string,
    public readonly transform?: (val: number, ctx: any) => number
  ) {
    this.id = `__ref_${++refSeq}_${field}__`;
    if (REF_FINALIZER) {
      REF_MAP.set(this.id, new (globalThis as any).WeakRef(this) as RefSlot);
      REF_FINALIZER.register(this, this.id);
    } else {
      REF_MAP.set(this.id, { deref: () => this });
    }
  }

  resolve(ctx: any): number {
    if (!ctx) return 0;
    const val = Number(ctx[this.field] ?? 0);
    return this.transform ? this.transform(val, ctx) : val;
  }

  [Symbol.toPrimitive](): string {
    return this.id;
  }

  toString(): string {
    return this.id;
  }
}

export function isRef(v: any): v is Ref {
  return (
    v instanceof Ref ||
    (typeof v === "object" && v !== null && (v as any).__isRef === true)
  );
}

declare const REF_INDEX: unique symbol;

/**
 * `ref()` 的返回值类型. 运行时是一个 `Ref` 对象, 但类型上声明为
 * `number & {...}` —— 这样 `uint8_t[ref("msg_size")]` 就能命中 `StructType extends
 * Array<...>` 的下标签名, 由 `uint8_t` 的字节段形态推出 `Uint8Array`, 从而让
 * `InferDef` 拿到真实类型. `ref` 原先声明为 `any`, 推导到这里就断了.
 */
export type RefIndex = number & { readonly [REF_INDEX]?: Ref };

export function ref(
  field: string,
  transform?: (val: number, ctx: any) => number
): RefIndex {
  return new Ref(field, transform) as any;
}

export function arrayProxy(
  context: any,
  cb: (target: any, index: any) => any
) {
  return new Proxy(context, {
    get(t: any, k: string | number | symbol) {
      if (k in t) return t[k];
      if (typeof k === "string") {
        const slot = REF_MAP.get(k);
        if (slot) {
          const r = slot.deref();
          if (r) return cb(t, r);
        }
        if (k.startsWith("__ref_")) {
          const m = k.match(/^__ref_\d+_(.+)__$/);
          if (m) {
            return cb(t, new Ref(m[1]));
          }
        }
        if (/\d+/.test(k)) return cb(t, parseInt(k));
      }
    },
  });
}

export function arrayProxyNext(context: any, klass: Type<any>) {
  return arrayProxy(context, (t, i) => {
    const next = new klass();
    Object.setPrototypeOf(next, context);
    Object.assign(next, t);
    next.deeps = [...(context.deeps ?? []), i];
    return next;
  });
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

class FallbackTextDecoder {
  decode(buf?: ArrayBuffer | ArrayBufferView): string {
    if (!buf) return "";
    const u8 = ArrayBuffer.isView(buf)
      ? new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
      : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < u8.length; i++) {
      s += "%" + u8[i].toString(16).padStart(2, "0");
    }
    try {
      return decodeURIComponent(s);
    } catch {
      let out = "";
      for (let i = 0; i < u8.length; i++) out += String.fromCharCode(u8[i]);
      return out;
    }
  }
}

class FallbackTextEncoder {
  encode(str: string): Uint8Array {
    let s = "";
    try {
      s = unescape(encodeURIComponent(str));
    } catch {
      s = str;
    }
    const arr = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) {
      arr[i] = s.charCodeAt(i) & 0xff;
    }
    return arr;
  }
}

export function createTextDecoder(): TextDecoder {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder();
  }
  return new FallbackTextDecoder() as any;
}

export function createTextEncoder(): TextEncoder {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder();
  }
  return new FallbackTextEncoder() as any;
}

/**
 * ```ts
 * b2('abc 0x640x0a')
 * b2('abc 0x640ah')
 * b2('abc \\x640ah')
 * // => <61 62 63 20 64 0a>
 * ```
 */
export function sbytes2(str: string, te = createTextEncoder()): DataView {
  let m;
  const bytes = [];
  while (str.length) {
    m = str.match(HEX_EXP);
    if (m && m[1]) {
      const v = m[2] ?? m[3] ?? m[4] ?? 0;
      bytes.push(parseInt(v, 16));
      str = str.substr(m[1].length);
    } else if (str.length) {
      const i = str.search(HEX_SEARCH_EXP);
      if (i < 0) {
        // all string
        bytes.push(...te.encode(str));
        str = "";
      } else {
        const s = str.substr(0, i);
        bytes.push(...te.encode(s));
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
 * TEXT(view)
 * // => "abc..xyz........"
 *
 * TEXT(view, "^")
 * // => "abc^^xyz^^^^^^^^"
 * ```
 */
export function TEXT(
  buf: number[] | ArrayBufferView,
  placeholder?: ((byte: number) => string) | string
): string;
export function TEXT(
  buf: number[] | ArrayBufferView,
  text?: TextDecoder,
  placeholder?: ((byte: number) => string) | string
): string;
export function TEXT(
  buf: number[] | ArrayBufferView,
  text?: any,
  placeholder?: any
): string {
  const view = makeDataView(buf);

  if (!text && !placeholder) {
    text = createTextDecoder();
  } else if (
    (text !== undefined && typeof text === "string") ||
    typeof text === "function"
  ) {
    placeholder = text;
    text = createTextDecoder();
  }
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
          str += text.decode(Uint8Array.from(strBytes));
          strBytes = [];
        }
        str += placeholder
          ? typeof placeholder === "string"
            ? placeholder
            : placeholder(byte)
          : ".";
      }
    } catch (error) {
      if (strBytes.length) str += text.decode(Uint8Array.from(strBytes));
      break;
    }
  }
  return str;
}

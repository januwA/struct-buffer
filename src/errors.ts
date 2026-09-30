import { DecodeBuffer_t } from "./interfaces";
import { makeDataView } from "./utils";

const HEX_DUMP_LEN = 16;

/**
 * 越界处的原始字节(最多 16B), 抓包场景下这串 hex 就是唯一有用的定位信息
 */
function hexAt(view: DataView, offset: number, len: number): string {
  const out: string[] = [];
  for (let i = 0; i < len; i++) {
    if (offset + i >= view.byteLength) break;
    out.push(view.getUint8(offset + i).toString(16).padStart(2, "0"));
  }
  return out.join(" ");
}

/**
 * 解码失败. 与 DataView 原生抛的 `RangeError: Offset is outside the bounds of
 * the DataView` 相比, 多了三层定位信息:
 *
 * - `where`  结构名 + 字段路径(嵌套结构体一路累加, 如 `InFrame.body.op`)
 * - `offset` 出错时的绝对字节偏移
 * - `hex`    出错处的原始字节
 *
 * 抓包解析里长度字段被垃圾数据带偏是常态, 裸 RangeError 无法定位, 所以
 * 越界一律包装成本错误。
 */
export class DecodeError extends Error {
  override readonly name = "DecodeError";

  constructor(
    /** 结构名 + 字段路径, 如 `InFrame.body.op` */
    readonly where: string,
    /** 绝对字节偏移 */
    readonly offset: number,
    /** 需要的字节数 */
    readonly need: number,
    /** 实际剩余字节数 */
    readonly have: number,
    /** 出错处的原始字节(最多 16B) */
    readonly hex: string
  ) {
    super(
      `DecodeError: ${where} @${offset} 需要 ${need}B, 只剩 ${have}B` +
        (hex ? `  hex: ${hex}` : "")
    );
    Object.setPrototypeOf(this, DecodeError.prototype);
  }

  static at(
    view: DecodeBuffer_t,
    where: string,
    offset: number,
    need: number
  ): DecodeError {
    const v = makeDataView(view);
    return new DecodeError(
      where,
      offset,
      need,
      Math.max(0, v.byteLength - offset),
      hexAt(v, offset, HEX_DUMP_LEN)
    );
  }

  /**
   * 不是"字节不够", 而是**字节够但内容不对**(判别字段没有对应分支 / 子帧没前进).
   * 这类错误没有"需要几字节"可言, 硬塞进 hex 槽位只会让消息变成
   * `需要 0B, 只剩 0B hex: msg_type=3 没有对应分支` —— 越读越糊涂.
   */
  static reason(where: string, offset: number, reason: string): DecodeError {
    const e = new DecodeError(where, offset, 0, 0, "");
    e.message = `DecodeError: ${where} @${offset} ${reason}`;
    return e;
  }
}

/**
 * 编码失败. 多数是 schema 与数据不匹配(如 ref 指向的字段不存在/为负), 属于
 * 调用方的 bug, 所以只补上 where 定位, 不带 hex.
 */
export class EncodeError extends Error {
  override readonly name = "EncodeError";

  constructor(readonly where: string, message: string) {
    super(`EncodeError: ${where} ${message}`);
    Object.setPrototypeOf(this, EncodeError.prototype);
  }
}

/**
 * 宽松解码的产物: 即使有字段失败, 已解析成功的部分照样返回
 */
export interface LenientResult<D> {
  /** 已解析出的值(出错字段为 undefined) */
  value: D;
  /** 全部失败点, 顺序与字段声明顺序一致 */
  errors: DecodeError[];
  /** 实际消费的字节数 */
  consumed: number;
}

import { DecodeBuffer_t } from "./interfaces";
import { DecodeError } from "./errors";
import { makeDataView } from "./utils";

/**
 * 读/写位置的唯一真源.
 *
 * 旧实现把 `offset: number` 当参数逐层传递, 而 `decode` 不返回推进后的值, 于是每个
 * 嵌套点都要手写 `offset += getByteLength(sub)` —— 一套**与实际消费脱钩的第二套尺寸
 * 计算**. 两者一旦不一致就是静默损坏(`DynamicStructBuffer` 的嵌套 list 就是这么坏的:
 * 声明 4B 实际写出 10B).
 *
 * Cursor 消灭了这个问题: offset 是对象状态而不是参数, 字段读完 cursor 自动停在该字段之后,
 * 下一个字段接着读. 嵌套结构体**直接共享同一个 cursor**, 连尺寸计算都不需要。
 *
 * `end` 让 cursor 天然支持子区域: 自定界子帧(有自己的长度头)用 `region()` 划出窗口,
 * 父 cursor 整块跳过, 区域尾部没消费的字节不会漏算进父结构。
 */
/** 位置的共享单元. 多个 Cursor 可以共用一个 `pos`, 各自带不同的错误定位串 */
interface CursorState {
  pos: number;
}

export class Cursor {
  readonly view: DataView;
  private readonly st: CursorState;

  constructor(
    view: DecodeBuffer_t,
    pos: number = 0,
    /** 本 cursor 可访问的末尾(开区间); 默认整个 view */
    public readonly end?: number,
    /** 结构名 + 字段路径前缀, 错误信息用 */
    public readonly where: string = "",
    /** 与别的 cursor 共享位置; 省略则是独立窗口(见 `region`) */
    st?: CursorState
  ) {
    this.view = makeDataView(view);
    this.st = st ?? { pos };
  }

  get pos(): number {
    return this.st.pos;
  }

  set pos(v: number) {
    this.st.pos = v;
  }

  /**
   * **同一位置的另一个标签**: 嵌套结构体用它把错误定位串带进子结构
   * (`Outer` → `Outer.inner`) 而不必真的划子窗口 —— 位置照旧是同一个, 所以父字段
   * 不需要知道子结构体消费了多少字节。
   *
   * 与 `region()` 的区别: `region` 开一个**独立**的定长窗口, `sub` 只是加标签。
   */
  sub(field: string): Cursor {
    return new Cursor(this.view, this.pos, this.end, this.label(field), this.st);
  }

  get limit(): number {
    return this.end ?? this.view.byteLength;
  }

  /** 剩余可读字节数 */
  get left(): number {
    return this.limit - this.pos;
  }

  get done(): boolean {
    return this.pos >= this.limit;
  }

  /** 拼出完整定位串, 如 `InFrame` + `body` => `InFrame.body` */
  label(field: string): string {
    return this.where ? `${this.where}.${field}` : field;
  }

  /** 越界 = 抛包装过的 DecodeError(带 where/offset/hex), 绝不漏出裸 RangeError */
  need(n: number, field: string): void {
    if (n > this.left) throw this.error(field, n);
  }

  error(field: string, need: number): DecodeError {
    const where = this.label(field);
    const hex =
      this.pos < this.view.byteLength
        ? this.view
            .getUint8(this.pos)
            .toString(16)
            .padStart(2, "0")
        : "";
    return new DecodeError(where, this.pos, need, this.left, hex);
  }

  skip(n: number, field: string): void {
    this.need(n, field);
    this.pos += n;
  }

  // ---- 标量读取: 每个都带边界检查, littleEndian 由调用方从 schema 继承 ----

  u8(field: string): number {
    this.need(1, field);
    return this.view.getUint8(this.pos++);
  }

  i8(field: string): number {
    this.need(1, field);
    return this.view.getInt8(this.pos++);
  }

  u16(field: string, le: boolean = false): number {
    this.need(2, field);
    const v = this.view.getUint16(this.pos, le);
    this.pos += 2;
    return v;
  }

  i16(field: string, le: boolean = false): number {
    this.need(2, field);
    const v = this.view.getInt16(this.pos, le);
    this.pos += 2;
    return v;
  }

  u32(field: string, le: boolean = false): number {
    this.need(4, field);
    const v = this.view.getUint32(this.pos, le);
    this.pos += 4;
    return v;
  }

  i32(field: string, le: boolean = false): number {
    this.need(4, field);
    const v = this.view.getInt32(this.pos, le);
    this.pos += 4;
    return v;
  }

  f32(field: string, le: boolean = false): number {
    this.need(4, field);
    const v = this.view.getFloat32(this.pos, le);
    this.pos += 4;
    return v;
  }

  f64(field: string, le: boolean = false): number {
    this.need(8, field);
    const v = this.view.getFloat64(this.pos, le);
    this.pos += 8;
    return v;
  }

  u64(field: string, le: boolean = false): number {
    this.need(8, field);
    const v = this.view.getBigUint64(this.pos, le);
    this.pos += 8;
    return Number(v);
  }

/**
   * 取 n 字节**零拷贝**子视图(借用底层 buffer, 不复制).
   * blob 字段用它把字节直接交出去; 解码源本身是 `readByteArray` 出来的
   * 独立拷贝, 所以子视图的生命周期安全。
   */
  bytes(n: number, field: string): Uint8Array {
    this.need(n, field);
    const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
    this.pos += n;
    return v;
  }

  /**
   * 定长子区域: 划出 n 字节窗口交给 `fn` 解析, 结束后父 cursor **整块跳过** n 字节.
   *
   * 区域尾部没被 `fn` 消费的字节(对齐填充/未知尾巴)不会漏进父结构, 也不会让父结构错位。
   * 自定界子帧(`framed`)与"长度头 + 子体"类字段靠它与外界隔离。
   */
  region<T>(n: number, field: string, fn: (c: Cursor) => T): T {
    this.need(n, field);
    const start = this.pos;
    const value = fn(
      new Cursor(this.view, start, start + n, this.label(field))
    );
    this.pos = start + n;
    return value;
  }

  /**
   * 只读子区域: 不消费父 cursor, 返回子结果与实际消费字节数.
   * 帧尾残余字节之类"看到了但不属于本结构"的数据用这个.
   */
  peek<T>(n: number, field: string, fn: (c: Cursor) => T): { value: T; size: number } {
    this.need(n, field);
    const start = this.pos;
    const child = new Cursor(this.view, start, start + n, this.label(field));
    const value = fn(child);
    return { value, size: child.pos - start };
  }

  /** 从当前 pos 到 limit 剩余全部字节, 零拷贝 */
  rest(field: string): Uint8Array {
    return this.bytes(this.left, field);
  }
}

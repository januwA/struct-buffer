import { EncodeError } from "./errors";

const MIN_CAPACITY = 64;

/**
 * 写位置. `Cursor` 的对偶: 同样是"位置即状态", 不再把 offset 当参数层层传递.
 *
 * 两种模式:
 * - **可增长**(默认): 自己持有 ArrayBuffer, 写满就翻倍扩容. 所以 `encode` 不需要
 *   "先算总长再分配"那一遍预扫描 —— 也就是不需要让 `byteLength` 参与缓冲分配.
 * - **定长**(`new Writer({view})`): 写进调用方给的 buffer, 越界即 `EncodeError`.
 *   原地改写场景(对端已按定长分配好 buffer, 帧必须等长)必须走这条.
 */
export class Writer {
  private buf: DataView;
  private readonly start: number;
  private readonly fixed: boolean;

  pos = 0;

  constructor(
    private readonly opts: {
      view?: DataView;
      offset?: number;
      littleEndian: boolean;
      capacity?: number;
    }
  ) {
    this.fixed = !!opts.view;
    this.buf =
      opts.view ?? new DataView(new ArrayBuffer(opts.capacity ?? MIN_CAPACITY));
    this.start = opts.offset ?? 0;
    this.pos = this.start;
  }

  get littleEndian(): boolean {
    return this.opts.littleEndian;
  }

  /** 底层 buffer(不切片). 交给 `StructType.encode` 就地写时用这个 */
  get raw(): DataView {
    return this.buf;
  }

  /** 还能写多少字节(定长模式) */
  get room(): number {
    return this.fixed ? this.buf.byteLength - this.pos : Infinity;
  }

  /**
   * 保证还能写 n 字节. `StructType.encode` 拿到 view 后是**盲写**(不检查
   * `createDataView(size, view)` 直接返回 view), 所以必须先扩容, 否则会漏出
   * 裸 `RangeError`.
   */
  reserve(n: number): void {
    this.grow(n);
  }

  /**
   * `StructType.encode` 内部换了底层 buffer 时换回来. 偏移语义不变: 新 view 同样从 0
   * 开始, 所以绝对 offset 可以直接沿用.
   */
  rebind(view: DataView): void {
    this.buf = view;
  }

  advance(n: number): void {
    this.pos += n;
  }

  private grow(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    if (this.fixed) {
      throw new EncodeError(
        "encodeInto",
        `写入越界: 需要 ${n}B, 只剩 ${this.room}B ` +
          `(pos=${this.pos}, view=${this.buf.byteLength}B)`
      );
    }
    const need = this.pos + n;
    let cap = this.buf.byteLength || MIN_CAPACITY;
    while (cap < need) cap *= 2;
    const next = new DataView(new ArrayBuffer(cap));
    for (let i = 0; i < this.pos; i++) next.setUint8(i, this.buf.getUint8(i));
    this.buf = next;
  }

  u8(v: number): void {
    this.grow(1);
    this.buf.setUint8(this.pos++, v & 0xff);
  }

  i8(v: number): void {
    this.grow(1);
    this.buf.setInt8(this.pos++, (v << 24) >> 24);
  }

  u16(v: number): void {
    this.grow(2);
    this.buf.setUint16(this.pos, v, this.opts.littleEndian);
    this.pos += 2;
  }

  i16(v: number): void {
    this.grow(2);
    this.buf.setInt16(this.pos, v, this.opts.littleEndian);
    this.pos += 2;
  }

  u32(v: number): void {
    this.grow(4);
    this.buf.setUint32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }

  i32(v: number): void {
    this.grow(4);
    this.buf.setInt32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }

  f32(v: number): void {
    this.grow(4);
    this.buf.setFloat32(this.pos, v, this.opts.littleEndian);
    this.pos += 4;
  }

  f64(v: number): void {
    this.grow(8);
    this.buf.setFloat64(this.pos, v, this.opts.littleEndian);
    this.pos += 8;
  }

  u64(v: number): void {
    this.grow(8);
    this.buf.setBigUint64(this.pos, BigInt(v), this.opts.littleEndian);
    this.pos += 8;
  }

  bytes(src: Uint8Array): void {
    this.grow(src.length);
    for (let i = 0; i < src.length; i++) this.buf.setUint8(this.pos++, src[i]);
  }

  zero(n: number): void {
    this.grow(n);
    while (n-- > 0) this.buf.setUint8(this.pos++, 0);
  }

  /** 已写入字节数(不含定长模式下的 start 偏移) */
  get written(): number {
    return this.pos - this.start;
  }

  /** 定长模式返回原 view; 可增长模式返回恰好 `written` 字节的切片 */
  finish(): DataView {
    return this.fixed
      ? this.buf
      : new DataView(
          this.buf.buffer.slice(
            this.buf.byteOffset + this.start,
            this.buf.byteOffset + this.pos
          )
        );
  }
}

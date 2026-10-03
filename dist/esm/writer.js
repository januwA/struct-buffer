import { EncodeError } from "./errors";
const MIN_CAPACITY = 64;
export class Writer {
    constructor(opts) {
        this.opts = opts;
        this.pos = 0;
        this.fixed = !!opts.view;
        this.buf =
            opts.view ?? new DataView(new ArrayBuffer(opts.capacity ?? MIN_CAPACITY));
        this.start = opts.offset ?? 0;
        this.pos = this.start;
    }
    get littleEndian() {
        return this.opts.littleEndian;
    }
    get raw() {
        return this.buf;
    }
    get room() {
        return this.fixed ? this.buf.byteLength - this.pos : Infinity;
    }
    reserve(n) {
        this.grow(n);
    }
    rebind(view) {
        this.buf = view;
    }
    advance(n) {
        this.pos += n;
    }
    grow(n) {
        if (this.pos + n <= this.buf.byteLength)
            return;
        if (this.fixed) {
            throw new EncodeError("encodeInto", `写入越界: 需要 ${n}B, 只剩 ${this.room}B ` +
                `(pos=${this.pos}, view=${this.buf.byteLength}B)`);
        }
        const need = this.pos + n;
        let cap = this.buf.byteLength || MIN_CAPACITY;
        while (cap < need)
            cap *= 2;
        const next = new DataView(new ArrayBuffer(cap));
        for (let i = 0; i < this.pos; i++)
            next.setUint8(i, this.buf.getUint8(i));
        this.buf = next;
    }
    u8(v) {
        this.grow(1);
        this.buf.setUint8(this.pos++, v & 0xff);
    }
    i8(v) {
        this.grow(1);
        this.buf.setInt8(this.pos++, (v << 24) >> 24);
    }
    u16(v) {
        this.grow(2);
        this.buf.setUint16(this.pos, v, this.opts.littleEndian);
        this.pos += 2;
    }
    i16(v) {
        this.grow(2);
        this.buf.setInt16(this.pos, v, this.opts.littleEndian);
        this.pos += 2;
    }
    u32(v) {
        this.grow(4);
        this.buf.setUint32(this.pos, v, this.opts.littleEndian);
        this.pos += 4;
    }
    i32(v) {
        this.grow(4);
        this.buf.setInt32(this.pos, v, this.opts.littleEndian);
        this.pos += 4;
    }
    f32(v) {
        this.grow(4);
        this.buf.setFloat32(this.pos, v, this.opts.littleEndian);
        this.pos += 4;
    }
    f64(v) {
        this.grow(8);
        this.buf.setFloat64(this.pos, v, this.opts.littleEndian);
        this.pos += 8;
    }
    u64(v) {
        this.grow(8);
        this.buf.setBigUint64(this.pos, BigInt(v), this.opts.littleEndian);
        this.pos += 8;
    }
    i64(v) {
        this.grow(8);
        this.buf.setBigInt64(this.pos, BigInt(v), this.opts.littleEndian);
        this.pos += 8;
    }
    accessor(size, set, isBig, value, le) {
        this.grow(size);
        this.buf[set](this.pos, isBig ? BigInt(value) : value, le);
        this.pos += size;
    }
    bytes(src) {
        this.grow(src.length);
        for (let i = 0; i < src.length; i++)
            this.buf.setUint8(this.pos++, src[i]);
    }
    zero(n) {
        this.grow(n);
        while (n-- > 0)
            this.buf.setUint8(this.pos++, 0);
    }
    get written() {
        return this.pos - this.start;
    }
    finish() {
        return this.fixed
            ? this.buf
            : new DataView(this.buf.buffer.slice(this.buf.byteOffset + this.start, this.buf.byteOffset + this.pos));
    }
}

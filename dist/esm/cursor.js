import { DecodeError } from "./errors";
import { makeDataView } from "./utils";
export class Cursor {
    constructor(view, pos = 0, end, where = "", st) {
        this.end = end;
        this.where = where;
        this.view = makeDataView(view);
        this.st = st ?? { pos };
    }
    get pos() {
        return this.st.pos;
    }
    set pos(v) {
        this.st.pos = v;
    }
    sub(field) {
        return new Cursor(this.view, this.pos, this.end, this.label(field), this.st);
    }
    get limit() {
        return this.end ?? this.view.byteLength;
    }
    get left() {
        return this.limit - this.pos;
    }
    get done() {
        return this.pos >= this.limit;
    }
    label(field) {
        return this.where ? `${this.where}.${field}` : field;
    }
    need(n, field) {
        if (n > this.left)
            throw this.error(field, n);
    }
    error(field, need) {
        const where = this.label(field);
        const hex = this.pos < this.view.byteLength
            ? this.view
                .getUint8(this.pos)
                .toString(16)
                .padStart(2, "0")
            : "";
        return new DecodeError(where, this.pos, need, this.left, hex);
    }
    skip(n, field) {
        this.need(n, field);
        this.pos += n;
    }
    u8(field) {
        this.need(1, field);
        return this.view.getUint8(this.pos++);
    }
    i8(field) {
        this.need(1, field);
        return this.view.getInt8(this.pos++);
    }
    u16(field, le = false) {
        this.need(2, field);
        const v = this.view.getUint16(this.pos, le);
        this.pos += 2;
        return v;
    }
    i16(field, le = false) {
        this.need(2, field);
        const v = this.view.getInt16(this.pos, le);
        this.pos += 2;
        return v;
    }
    u32(field, le = false) {
        this.need(4, field);
        const v = this.view.getUint32(this.pos, le);
        this.pos += 4;
        return v;
    }
    i32(field, le = false) {
        this.need(4, field);
        const v = this.view.getInt32(this.pos, le);
        this.pos += 4;
        return v;
    }
    f32(field, le = false) {
        this.need(4, field);
        const v = this.view.getFloat32(this.pos, le);
        this.pos += 4;
        return v;
    }
    f64(field, le = false) {
        this.need(8, field);
        const v = this.view.getFloat64(this.pos, le);
        this.pos += 8;
        return v;
    }
    u64(field, le = false) {
        this.need(8, field);
        const v = this.view.getBigUint64(this.pos, le);
        this.pos += 8;
        return Number(v);
    }
    bytes(n, field) {
        this.need(n, field);
        const v = new Uint8Array(this.view.buffer, this.view.byteOffset + this.pos, n);
        this.pos += n;
        return v;
    }
    region(n, field, fn) {
        this.need(n, field);
        const start = this.pos;
        const value = fn(new Cursor(this.view, start, start + n, this.label(field)));
        this.pos = start + n;
        return value;
    }
    peek(n, field, fn) {
        this.need(n, field);
        const start = this.pos;
        const child = new Cursor(this.view, start, start + n, this.label(field));
        const value = fn(child);
        return { value, size: child.pos - start };
    }
    rest(field) {
        return this.bytes(this.left, field);
    }
}

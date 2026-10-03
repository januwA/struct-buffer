export class DecodeError extends Error {
    constructor(where, offset, need, have, hex) {
        super(`DecodeError: ${where} @${offset} 需要 ${need}B, 只剩 ${have}B` +
            (hex ? `  hex: ${hex}` : ""));
        this.where = where;
        this.offset = offset;
        this.need = need;
        this.have = have;
        this.hex = hex;
        this.name = "DecodeError";
        Object.setPrototypeOf(this, DecodeError.prototype);
    }
    static reason(where, offset, reason) {
        const e = new DecodeError(where, offset, 0, 0, "");
        e.message = `DecodeError: ${where} @${offset} ${reason}`;
        return e;
    }
}
export class EncodeError extends Error {
    constructor(where, message) {
        super(`EncodeError: ${where} ${message}`);
        this.where = where;
        this.name = "EncodeError";
        Object.setPrototypeOf(this, EncodeError.prototype);
    }
}

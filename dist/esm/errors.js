import { makeDataView } from "./utils";
const HEX_DUMP_LEN = 16;
function hexAt(view, offset, len) {
    const out = [];
    for (let i = 0; i < len; i++) {
        if (offset + i >= view.byteLength)
            break;
        out.push(view.getUint8(offset + i).toString(16).padStart(2, "0"));
    }
    return out.join(" ");
}
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
    static at(view, where, offset, need) {
        const v = makeDataView(view);
        return new DecodeError(where, offset, need, Math.max(0, v.byteLength - offset), hexAt(v, offset, HEX_DUMP_LEN));
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

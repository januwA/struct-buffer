import { sizeof } from "./struct-buffer";
import { bool, string_t, padding_t, char, uchar, short, ushort, int, uint, long, ulong, longlong, ulonglong, float, double, } from "./types";
import { createDataView, makeDataView } from "./utils";
const SECTION_ORDER = [">", "<", "!"];
const LEN_EXP = /^(\d+)(?=\w|\?)/i;
function _getTypes(format) {
    let m;
    const types = [];
    while (format.length) {
        m = format.match(LEN_EXP);
        let len = 1;
        if (m && m[1]) {
            len = parseInt(m[1]);
            format = format.substr(m[1].length);
        }
        switch (format[0]) {
            case "x":
                types.push(padding_t[len]);
                break;
            case "c":
            case "b":
                types.push(char[len]);
                break;
            case "B":
                types.push(uchar[len]);
                break;
            case "?":
                types.push(bool[len]);
                break;
            case "h":
                types.push(short[len]);
                break;
            case "H":
                types.push(ushort[len]);
                break;
            case "i":
            case "n":
                types.push(int[len]);
                break;
            case "I":
            case "N":
                types.push(uint[len]);
                break;
            case "l":
                types.push(long[len]);
                break;
            case "L":
                types.push(ulong[len]);
                break;
            case "q":
                types.push(longlong[len]);
                break;
            case "Q":
                types.push(ulonglong[len]);
                break;
            case "e":
            case "f":
                types.push(float[len]);
                break;
            case "d":
                types.push(double[len]);
                break;
            case "s":
            case "p":
                types.push(string_t[len]);
                break;
            default:
                throw new Error(`没有(${format[0]})格式!`);
        }
        format = format.substr(1);
    }
    return types;
}
function _getLittleEndian(str) {
    switch (str) {
        case ">":
        case "!":
            return false;
        case "<":
            return true;
        default:
            throw new Error("错误的字节序");
    }
}
function _handleParams(format, buffer) {
    format = format.replace(/\s/g, "");
    let _sr = SECTION_ORDER[0];
    if (SECTION_ORDER.includes(format[0])) {
        _sr = format[0];
        format = format.substr(1);
    }
    return {
        littleEndian: _getLittleEndian(_sr),
        view: makeDataView(buffer),
        types: _getTypes(format),
    };
}
export function pack(format, ...args) {
    return pack_into(format, createDataView(calcsize(format)), 0, ...args);
}
export function pack_into(format, buffer, offset, ...args) {
    const { littleEndian, types, view } = _handleParams(format, buffer);
    while (types.length) {
        const type = types.shift();
        if (!type)
            break;
        if (type.is(padding_t)) {
            type.encode(0, littleEndian, offset, view);
        }
        else if (type.is(string_t)) {
            type.encode(args.shift(), littleEndian, offset, view);
        }
        else {
            const obj = [];
            for (let i = 0; i < type.count; i++)
                obj.push(args.shift());
            type.encode(obj, littleEndian, offset, view);
        }
        offset += sizeof(type);
    }
    return view;
}
export function unpack(format, buffer, offset = 0) {
    const { littleEndian, types, view } = _handleParams(format, buffer);
    const result = [];
    while (types.length) {
        const type = types.shift();
        if (!type)
            break;
        if (!type.is(padding_t))
            result.push(type.decode(view, littleEndian, offset));
        offset += sizeof(type);
    }
    return result.flat();
}
export function unpack_from(format, buffer, offset = 0) {
    return unpack(format, buffer, offset);
}
export function iter_unpack(format, buffer) {
    const size = calcsize(format);
    let offset = 0;
    return {
        next() {
            try {
                return {
                    value: unpack(format, buffer, offset),
                    done: !(offset += size),
                };
            }
            catch (error) {
                return { value: null, done: true };
            }
        },
        [Symbol.iterator]() {
            return this;
        },
    };
}
export function calcsize(format) {
    format = format.replace(/\s/g, "");
    if (SECTION_ORDER.includes(format[0]))
        format = format.substr(1);
    const types = _getTypes(format);
    return types.reduce((acc, it) => acc + sizeof(it), 0);
}
export class Struct {
    constructor(format) {
        this.format = format;
        this.size = calcsize(format);
    }
    pack(...args) {
        return pack_into(this.format, createDataView(this.size), 0, ...args);
    }
    pack_into(buffer, offset, ...args) {
        return pack_into(this.format, buffer, offset, ...args);
    }
    unpack(buffer, offset = 0) {
        return unpack(this.format, buffer, offset);
    }
    unpack_from(buffer, offset = 0) {
        return unpack(this.format, buffer, offset);
    }
    iter_unpack(buffer) {
        return iter_unpack(this.format, buffer);
    }
}

export function unflattenDeep(array, deeps, isString = false) {
    let r = array;
    if (isString && typeof r === "string")
        r = r.split("");
    for (let i = deeps.length - 1; i >= 1; i--) {
        const isFirst = i === deeps.length - 1;
        const value = deeps[i];
        r = r.reduce((acc, it, index) => {
            if (index % value === 0)
                acc.push([]);
            acc[acc.length - 1].push(it);
            return acc;
        }, []);
        if (isString && isFirst) {
            r = r.map((it) => it.join(""));
        }
    }
    return r;
}
export function zeroMemory(view, length, offset) {
    while (length-- > 0)
        view.setUint8(offset++, 0);
}
export function createDataView(byteLength, view) {
    return view ? view : new DataView(new ArrayBuffer(byteLength));
}
export function makeDataView(view) {
    if (view instanceof DataView)
        return view;
    if (Array.isArray(view))
        view = Uint8Array.from(view);
    if (!ArrayBuffer.isView(view))
        throw new Error(`Type Error: (${view}) is not an ArrayBuffer!!!`);
    return new DataView(view.buffer);
}
export function arrayProxy(context, cb) {
    return new Proxy(context, {
        get(t, k) {
            if (k in t)
                return t[k];
            if (/\d+/.test(k.toString()))
                return cb(t, parseInt(k));
        },
    });
}
export function arrayProxyNext(context, klass) {
    return arrayProxy(context, (t, i) => {
        const next = new klass();
        Object.setPrototypeOf(next, context);
        Object.assign(next, t);
        next.deeps = [...(context.deeps ?? []), i];
        return next;
    });
}
export function sbytes(str) {
    str = str.replace(/0x|h|\\x|\s/gi, "");
    if (str.length % 2 !== 0)
        str = str.slice(0, -1);
    str = str.replace(/([0-9a-f]{2})(?=[0-9a-f])/gi, "$1 ");
    return new DataView(Uint8Array.from(str.split(/\s+/).map((it) => parseInt(it, 16))).buffer);
}
const HEX_EXP = /^(0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2}))/i;
const HEX_SEARCH_EXP = /0x([0-9a-f]{1,2})|([0-9a-f]{1,2})h|\\x([0-9a-f]{1,2})/i;
export function sbytes2(str, te = new TextEncoder()) {
    let m;
    const bytes = [];
    while (str.length) {
        m = str.match(HEX_EXP);
        if (m && m[1]) {
            const v = m[2] ?? m[3] ?? m[4] ?? 0;
            bytes.push(parseInt(v, 16));
            str = str.substr(m[1].length);
        }
        else if (str.length) {
            const i = str.search(HEX_SEARCH_EXP);
            if (i < 0) {
                bytes.push(...te.encode(str));
                str = "";
            }
            else {
                const s = str.substr(0, i);
                bytes.push(...te.encode(s));
                str = str.substr(i);
            }
        }
    }
    return new DataView(Uint8Array.from(bytes).buffer);
}
export function sview(view) {
    const v = makeDataView(view);
    const lst = [];
    for (let i = 0; i < v.byteLength; i++) {
        lst.push(v.getUint8(i).toString(16).padStart(2, "0"));
    }
    return lst.join(" ");
}
export function TEXT(buf, text, placeholder) {
    const view = makeDataView(buf);
    if (!text && !placeholder) {
        text = new TextDecoder();
    }
    else if ((text !== undefined && typeof text === "string") ||
        typeof text === "function") {
        placeholder = text;
        text = new TextDecoder();
    }
    let offset = 0;
    let str = "";
    let strBytes = [];
    while (true) {
        try {
            const byte = view.getUint8(offset++);
            if (byte >= 0x20) {
                strBytes.push(byte);
            }
            else {
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
        }
        catch (error) {
            if (strBytes.length)
                str += text.decode(Uint8Array.from(strBytes));
            break;
        }
    }
    return str;
}

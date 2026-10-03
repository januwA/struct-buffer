export function display(view, type, options) {
    const node = type.node;
    const opts = Object.assign({ hex: true, littleEndian: false }, options);
    let offset = 0;
    const result = [];
    while (true) {
        try {
            let value = view[node.get](offset, opts.littleEndian);
            if (opts.hex) {
                value = value
                    .toString(16)
                    .toUpperCase()
                    .padStart(node.size * 2, "0");
            }
            result.push({ offset, value });
            offset += node.size;
        }
        catch {
            break;
        }
    }
    return result;
}

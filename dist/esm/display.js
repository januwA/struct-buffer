export function display(view, type, options) {
    options = Object.assign({
        hex: true,
        littleEndian: false,
    }, options);
    let offset = 0;
    const result = [];
    while (true) {
        try {
            let value = view[type.get](offset, options.littleEndian);
            if (options.hex) {
                value = value
                    .toString(16)
                    .toUpperCase()
                    .padStart(type.size * 2, "0");
            }
            result.push({
                offset,
                value,
            });
            offset += type.size;
        }
        catch (error) {
            break;
        }
    }
    return result;
}

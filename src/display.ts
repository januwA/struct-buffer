import { ScalarNode } from "./engine";
import { DisplayResult } from "./interfaces";
import { ScalarCodec } from "./schema";

/**
 * 打印一段"不知道结构、只知道逐字段是什么标量"的字节.
 *
 * 旧实现从这里能看到类型的 `get`/`size`, 如今这两个信息在 AST 的标量节点上,
 * 所以直接取 `node` —— display 是内部工具, 不把 `node` 列为公共契约。
 */
export function display(
  view: DataView,
  type: ScalarCodec,
  options?: {
    /**
     * show hex
     */
    hex?: boolean;
    littleEndian?: boolean;
  }
): DisplayResult[] {
  const node = (type as unknown as { node: ScalarNode }).node;
  const opts = Object.assign({ hex: true, littleEndian: false }, options);
  let offset = 0;
  const result: DisplayResult[] = [];

  while (true) {
    try {
      let value = (view as any)[node.get](offset, opts.littleEndian);

      if (opts.hex) {
        value = value
          .toString(16)
          .toUpperCase()
          .padStart(node.size * 2, "0");
      }
      result.push({ offset, value });
      offset += node.size;
    } catch {
      break; // 直到溢出为止
    }
  }

  return result;
}

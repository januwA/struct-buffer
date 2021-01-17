import { StructType } from "./class-type";
import { DysplayResult } from "./interfaces";

/**
 *
 * ### The purpose of this function is to print some "ArrayBuffers that do not know the data structure"
 *
 * @param view
 * @param type
 * @param isHex
 * @param littleEndian
 */
export function display(
  view: DataView,
  type: StructType,
  options?: {
    /**
     * show hex
     */
    hex?: boolean;
    littleEndian?: boolean;
  }
): DysplayResult[] {
  options = Object.assign(
    {
      hex: true,
      littleEndian: false,
    },
    options
  );
  let offset = 0;
  const result: DysplayResult[] = [];

  while (true) {
    try {
      let value = (view as any)[type.get](offset, options.littleEndian);

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
    } catch (error) {
      break; // 直到溢出为止
    }
  }

  return result;
}

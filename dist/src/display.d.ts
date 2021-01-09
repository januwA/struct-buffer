import { StructType } from "./class-type";
import { DysplayResult } from "./interfaces";
export declare function display(view: DataView, type: StructType, options?: {
    hex?: boolean;
    littleEndian?: boolean;
}): DysplayResult[];

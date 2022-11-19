import { DataViewGet_t } from "./interfaces";

export const hData: {
  readonly [size: number | string]:
    | {
        [unsigned: number]: DataViewGet_t;
      }
    | DataViewGet_t;
} = {
  1: {
    1: "getUint8",
    0: "getInt8",
  },
  2: {
    1: "getUint16",
    0: "getInt16",
  },
  4: {
    1: "getUint32",
    0: "getInt32",
  },
  8: {
    1: "getBigUint64",
    0: "getBigInt64",
  },
  f: "getFloat32",
  d: "getFloat64",
};
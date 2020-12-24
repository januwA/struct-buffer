import { StructType } from "./class-type";

export interface AnyObject {
  [key: string]: any;
}

export interface StructOption {
  [k: string]: StructType;
}

export interface Type<T extends Object> extends Function {
  new (...args: any[]): T;
}

export interface TypeHandleOptions {
  [key: string]: (opt: { set: string; get: string; size: number }) => void;
}

export interface DysplayResult {
  offset: number;
  value: any;
}

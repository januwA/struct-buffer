export interface AnyObject {
  [key: string]: any;
  [index: number]: any;
}

export interface Type<T extends Object> extends Function {
  new (...args: any[]): T;
}
export interface DysplayResult {
  offset: number;
  value: any;
}

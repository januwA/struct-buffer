import { AbstractIntAccessArray } from "./AbstractIntAccessArray";
import { unflattenDeep } from "../utils";

/**
 * 结构可以是嵌套的
 */
export class TypeDeep<T> extends AbstractIntAccessArray<T> {
  /**
   * 最少返回 1
   */
  length: number = 1;

  /**
   * 记录每次嵌套的长度
   *
   * 比如: `int[2][3]` => [2, 3]
   */
  protected deeps: number[] = [];

  protected isList: boolean = false;

  intAccess(i: number) {
    const _next = new TypeDeep<T>();
    Object.setPrototypeOf(_next, this);

    _next.isList = true;
    _next.deeps = [...this.deeps, i];
    _next.length = _next.deeps.reduce((acc, it) => (acc *= it), 1);

    return _next;
  }

  protected unflattenDeep(result: any[], isString = false) {
    return this.isList
      ? unflattenDeep(result, this.deeps, isString)
      : result[0];
  }

  protected resultEach(obj: any, cb: (item: any, index: number) => void) {
    return this.unflattenDeep(this.each(obj, cb));
  }

  protected each(obj: any, cb: (item: any, index: number) => void): any[] {
    if (this.isList && Array.isArray(obj)) obj = obj.flat();
    else obj = [obj];

    const res = [];
    for (let i = 0; i < this.length; i++) {
      res.push(cb(obj[i], i));
    }
    return res;
  }
}

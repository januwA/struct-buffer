import { unflattenDeep } from "./utils";

export abstract class AbstractNumberEnumArray<T> implements ArrayLike<T> {
  readonly [n: number]: T;

  abstract length: number;

  /**
   * 每次使用数字枚举时，都会触发这个函数
   *
   * @param i
   */
  abstract next(i: number): any;

  constructor() {
    return new Proxy(this, {
      get(target: any, k: string | symbol) {
        if (k in target) return target[k];
        if (typeof k === "string" && /\d+/.test(k)) {
          return target.next(parseInt(k));
        }
      },
    });
  }
}

/**
 * 结构可以是嵌套的
 *
 * 就像这样：`int[2][3]` => [[0,0], [0,0], [0,0]]
 */

export class TypeDeep<T> extends AbstractNumberEnumArray<T> {
  /**
   * 嵌套数
   *
   * ```
   * bool.count = 1
   * bool[2].count == 2
   * BOOL[2][2].count == 4
   * ```
   *
   * 最少返回 1
   */
  length: number = 1;

  /**
   * 记录每次嵌套的长度
   *
   * 比如: `int[2][3]` => [2, 3]
   */
  protected deeps: number[] = [];

  /**
   * 这会影响到decode的返回值，和encode的解析值类型。
   *
   * 如果返回true，decode将返回数组，encode的解析值也会当作数组处理。反之则会作为单个对象处理
   */
  protected isList: boolean = false;

  next(i: number) {
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
}

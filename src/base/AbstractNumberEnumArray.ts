/**
 * 监听数字枚举事件的数组
 */
export abstract class AbstractNumberEnumArray<T> implements ArrayLike<T> {
  readonly [n: number]: T;

  abstract length: number;

  /**
   * 每次使用数字枚举时，都会触发这个函数
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

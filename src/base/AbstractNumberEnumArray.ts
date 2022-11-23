export abstract class AbstractNumberEnumArray<T> implements ArrayLike<T> {
  readonly [n: number]: T;

  abstract length: number;

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

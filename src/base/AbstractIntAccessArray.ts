export abstract class AbstractIntAccessArray<T> implements ArrayLike<T> {
  readonly [n: number]: T;

  abstract length: number;

  abstract intAccess(i: number): any;

  constructor() {
    return new Proxy(this, {
      get(target: any, k: string | symbol) {
        if (k in target) return target[k];
        if (typeof k === "string" && /\d+/.test(k)) {
          return target.intAccess(parseInt(k));
        }
      },
    });
  }
}

import { DataViewGet_t, DataViewSetExcludeBig_t, IType } from "./interfaces";
import { typeHandle, unflattenDeep } from "./utils";

/**
 * 结构可以是嵌套的
 *
 * 就像这样：`int[2][3]` => [[0,0], [0,0], [0,0]]
 */
export abstract class AbstractDeep<T> implements ArrayLike<T> {
  readonly [n: number]: T;
  get length() {
    return this.isList ? this.deeps[this.deeps.length - 1] : 0;
  }

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
   *
   * 一般情况会返回 `Boolean(deeps.length)`
   */
  get isList(): boolean {
    return Boolean(this.deeps.length);
  }

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
  get count(): number {
    return this.deeps.reduce((acc, it) => (acc *= it), 1);
  }

  protected unflattenDeep(result: any[], isString = false) {
    return this.isList
      ? unflattenDeep(result, this.deeps, isString)
      : result[0];
  }
}

export abstract class AbstractType<T> extends AbstractDeep<T> implements IType {
  get: DataViewGet_t;
  set: DataViewSetExcludeBig_t;
  names: string[] = [];

  constructor(
    typeName: string | string[],
    public size: number,
    public readonly unsigned: boolean
  ) {
    super();
    this.names = Array.isArray(typeName) ? typeName : [typeName];
    const [get, set] = typeHandle(this);
    this.set = set;
    this.get = get;
  }

  is(type: AbstractType<T>): boolean {
    return type.names.some((name) => this.names.includes(name));
  }

  isName(typeName: string) {
    return this.names.includes(typeName);
  }
}

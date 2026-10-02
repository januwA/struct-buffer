import { AnyObject, DecodeBuffer_t } from "./interfaces";
import { Cursor } from "./cursor";
import { Writer } from "./writer";
import { LenientResult } from "./errors";
import {
  Ctx,
  Def,
  ErrorSink,
  Field,
  flatten,
  nest,
  normalizeDef,
  resolveLengths,
  runFields,
} from "./field";
import { StructBuffer, StructBufferConfig, Type_t } from "./struct-buffer";
import { InferDef, InferEncodeDef } from "./infer";
import { arrayProxyNext, COUNT, isRef, Ref } from "./utils";

/**
 * 字段可以是什么. `DynamicStructBuffer` 这里**必须写全三个类型参数**: 裸名字会连带
 * 把 D/E 的默认值(`InferDef<S>` / `Partial<InferEncodeDef<S>>`)实例化一遍, 而推导里
 * 又要用 `DynamicStructBuffer` 做模式匹配 —— 于是自己引用自己, TS4109.
 * D/E 给 `any` 就等于"这里不参与推导", 也正是这层需要的语义.
 */
export type DynamicFieldType =
  | Type_t
  | DynamicStructBuffer<DynamicStructDef, any, any>
  | { [k: string]: any };
export type DynamicStructDef = { [key: string]: DynamicFieldType };

class DynamicStructBufferNext {
  constructor() {
    return arrayProxyNext(this, DynamicStructBufferNext);
  }
}

const KDynamicConfig: StructBufferConfig = {
  littleEndian: undefined,
};

/**
 * 字段表在构造期就归一化好(见 `field.ts`), 所以 decode/encode 只做一件事:
 * 拿一个 Cursor/Writer 从头走到尾.
 *
 * 相对旧实现的三处结构性变化:
 * 1. **位置即状态**: 嵌套结构体共享同一个 Cursor, 不再有"外层循环 + 内部整段
 *    decode"造成的 N² 与 `offset += getByteLength(sub)` 偏移漂移(那正是嵌套
 *    list encode 出 10B 全 0 / decode 抛 RangeError 的根因)。
 * 2. **只有一套尺寸模型**: `TypeField` 用 `type.getSize(ctx)`, 嵌套结构体
 *    不再另算一遍 `getStructSingleByteLength`。
 * 3. **encode 不篡改入参**: 长度回填走 `resolveLengths` 的写时复制, 旧实现的
 *    `prepItem` 会把调用方对象的 `msg_size` 直接写掉。
 */
/**
 * 类型参数顺序是 `<S, D, E>`:
 *
 * - `S` 字段表定义, 只用来推 D/E(默认 `DynamicStructDef` = 推导不出来时的退化形态)
 * - `D` decode 结果类型(默认 `InferDef<S>`)
 * - `E` encode 入参类型(默认 `Partial<InferEncodeDef<S>>`)
 *
 * 把 `S` 放第一位是**破坏性变更**: 老签名是 `<D, E>`, 老调用方的 `MyType` 会被
 * 当成 `S` 直接报错. 之所以仍然这么排, 是因为类的类型参数默认值不能引用后声明的
 * 参数(TS2744), 而 `D` 的默认值就是 `InferDef<S>` —— 想保住 `<D, E>` 的位置就
 * 只能让推导失效.
 *
 * 需要显式指定类型时写 `new DynamicStructBuffer<any, MyType>(...)`: `S` 填 `any`
 * 就等于放弃推导, `D` 仍然生效.
 */
export class DynamicStructBuffer<
  S extends DynamicStructDef = DynamicStructDef,
  D = InferDef<S>,
  E = Partial<InferEncodeDef<S>>
  // 和 StructType 一样靠下标把 D 推成数组: `Item[ref("n")]` 在运行时就是一个列表,
  // 元素类型必须是 `D[]`. 少了这两个 [], 下标推不出"几个"(元素类型不变 = 无信息)
> extends Array<DynamicStructBuffer<S, D[], E[]>> {
  deeps: (number | Ref)[] = [];
  config: StructBufferConfig;
  readonly structKV: [string, DynamicFieldType][];
  /** 归一化后的字段表; 也让本类可以当嵌套 def 用 */
  readonly def: Def;

  constructor(
    public readonly structName: string,
    /**
     * 类型必须是 `S` 而不是 `DynamicStructDef`: 只有直接拿 `S` 当参数类型, 才能
     * 从对象字面量反推出 `D = InferDef<S>`. 写成约束的话 S 拿不到推断候选, 只能
     * 退回约束本身, `decode()` 的结果就退化成 `{[k: string]: any}`.
     */
    public readonly struct: S,
    config?: StructBufferConfig
  ) {
    super();
    this.config = Object.assign({}, KDynamicConfig, config);
    this.structKV = Object.entries(struct);
    this.def = normalizeDef(
      struct as any,
      structName,
      this.config.littleEndian ?? false
    );
    return arrayProxyNext(this, DynamicStructBufferNext);
  }

  get isList(): boolean {
    return !!this.deeps.length;
  }

  get count(): number {
    return this.getCount();
  }

  /** 元素个数. `ctx[COUNT]` 是 Field 引擎回灌的显式个数, 优先级最高 */
  getCount(ctx?: any): number {
    if (ctx) {
      const n = ctx[COUNT];
      if (typeof n === "number") return n;
    }
    return this.deeps.reduce((acc: number, it) => {
      const val = isRef(it) ? it.resolve(ctx) : Number(it);
      return acc * val;
    }, 1);
  }

  getDeeps(ctx?: any): number[] {
    return this.deeps.map((it) => {
      if (isRef(it)) {
        return it.resolve(ctx);
      }
      return Number(it);
    });
  }

  private shapeOf(ctx?: any): number[] {
    return this.getDeeps(ctx).map((n) => (Number.isFinite(n) && n > 0 ? n : 0));
  }

  private cursor(view: DecodeBuffer_t, offset: number, le: boolean): Cursor {
    return new Cursor(
      view,
      offset,
      undefined,
      this.structName
    );
  }

  decode(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    parentCtx?: any
  ): D {
    void littleEndian; // 字节序已在构造期按 def 链定型
    const c = this.cursor(view, offset, this.config.littleEndian ?? false);
    const count = this.getCount(parentCtx);
    const root = new Ctx(parentCtx ?? {}, undefined);
    const values: any[] = [];

    for (let i = 0; i < count; i++) {
      const item: AnyObject = {};
      runFields(this.def.fields, c, item, root.child(item, i));
      values.push(item);
    }
    return nest(values, this.shapeOf(parentCtx)) as D;
  }

  /**
   * 宽松解码: 坏字段变 `undefined`, 尽量把能解析的都解析出来.
   *
   * 抓包/流式解析里"一帧里有个字段坏了"是常态, 整帧丢掉就等于没抓到. 恢复策略见
   * `runFields`: 定长字段失败照样跳过继续, 变长字段失败(长度被带偏)才停, 因为那时
   * 后续位置已经不可信.
   *
   * 只捕获 `DecodeError`; 自定义 codec 抛的其它异常照样往外炸.
   *
   * @returns 元素个数可能少于 `count` —— 提前停止时剩下的元素无从解析
   */
  decodeLenient(
    view: DecodeBuffer_t,
    littleEndian: boolean = false,
    offset: number = 0,
    parentCtx?: any
  ): LenientResult<D> {
    void littleEndian;
    const c = this.cursor(view, offset, this.config.littleEndian ?? false);
    const count = this.getCount(parentCtx);
    const root = new Ctx(parentCtx ?? {}, undefined);
    const sink: ErrorSink = { errors: [], stopped: false };
    const values: any[] = [];

    for (let i = 0; i < count; i++) {
      // 位置已不可信 ⇒ 剩下的元素无从解析; 当前元素已解出的字段仍然保留
      if (sink.stopped) break;
      const item: AnyObject = {};
      runFields(this.def.fields, c, item, root.child(item, i), sink);
      values.push(item);
    }
    return {
      value: nest(values, this.shapeOf(parentCtx)),
      errors: sink.errors,
      consumed: c.pos - offset,
    };
  }

  encode(
    obj: E,
    littleEndian: boolean = false,
    offset: number = 0,
    view?: DataView,
    parentCtx?: any
  ): DataView {
    void littleEndian; // 同 decode
    const w = new Writer({
      view,
      offset,
      littleEndian: this.config.littleEndian ?? false,
    });
    const count = this.getCount(parentCtx ?? obj);
    const items = this.isList ? flatten(obj) : [obj];
    const root = new Ctx(parentCtx ?? {}, undefined);

    for (let i = 0; i < count; i++) {
      const src = items[i];
      // 写时复制: 长度回填绝不落到调用方对象上
      const item: AnyObject = src == null ? {} : { ...(src as AnyObject) };
      const ctx = resolveLengths(this.def, item, root);
      const ictx = root.child(ctx, i);
      for (const f of this.def.fields) f.encode(w, ctx[f.name], ictx);
    }
    return w.finish();
  }

  /**
   * 编码后的字节数. 直接**量**出来而不是另写一套尺寸推算 —— 旧实现的
   * `getByteLength` 是与 `encode` 分叉的第二套算法, 两边不一致就是静默损坏.
   */
  getByteLength(obj?: any, parentCtx?: any): number {
    if (obj === undefined && this.def.fixedSize !== undefined) {
      return this.def.fixedSize * this.getCount(parentCtx);
    }
    if (obj === undefined) {
      throw new TypeError(
        `DynamicStructBuffer "${this.structName}" 含变长字段, getByteLength 需要一个样本对象`
      );
    }
    return this.encode(obj, false, 0, undefined, parentCtx).byteLength;
  }
}

/** 供 `sizeof()` 识别: 定长结构体报字节数, 变长报 undefined */
export function dynamicByteLength(
  type: DynamicStructBuffer | StructBuffer
): number | undefined {
  if (type instanceof StructBuffer) return type.byteLength;
  return type.def.fixedSize;
}

/** 归一化后的字段表, 供自定义字段/调试用 */
export type { Field, Def };

import { StructType } from "./class-type";
import type { ENCODE_VALUE_TYPE, VALUE_TYPE } from "./class-type";
import { Cursor } from "./cursor";
import { DecodeError } from "./errors";
import { AnyObject } from "./interfaces";
import { StructBuffer } from "./struct-buffer";
import { Writer } from "./writer";
export type Scope = "self" | "parent" | "root";
export interface RefSpec {
    field: string;
    scope?: Scope;
    transform?: (val: number, ctx: AnyObject) => number;
}
export type CountSpec = number | RefSpec | {
    product: CountSpec[];
} | {
    until: "end";
} | {
    stride: number;
};
export declare function isRefSpec(spec: CountSpec): spec is RefSpec;
export interface Site {
    where: string;
    field: string;
    offset: number;
}
export declare class Ctx {
    readonly values: AnyObject;
    readonly parent: Ctx | undefined;
    readonly index: number;
    constructor(values: AnyObject, parent: Ctx | undefined, index?: number);
    child(values: AnyObject, index?: number): Ctx;
    get root(): Ctx;
    get valuesFor(): AnyObject;
    lookup(path: string, scope?: Scope): any;
}
export declare function resolveCount(spec: CountSpec, ctx: Ctx, left: number, site: Site): number;
export declare function specText(spec: CountSpec): string;
export interface Field {
    readonly name: string;
    readonly fixedSize?: number;
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export interface ErrorSink {
    errors: DecodeError[];
    stopped: boolean;
}
export declare function runFields(fields: Field[], c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
export interface Def {
    name: string;
    fields: Field[];
    shape: number[];
    le: boolean;
    readonly fixedSize?: number;
}
export declare function nest(values: any[], shape: number[]): any;
export declare function flatten(value: any): any[];
export declare function resolveLengths(def: Def, obj: AnyObject, parent?: Ctx): AnyObject;
export declare class TypeField implements Field {
    readonly name: string;
    private readonly le;
    private readonly type;
    private readonly textDecode?;
    private readonly textEncoder?;
    readonly fixedSize?: number;
    private readonly spec;
    private readonly refSpec?;
    constructor(name: string, le: boolean, type: StructType<any, any>, textDecode?: TextDecoder | undefined, textEncoder?: TextEncoder | undefined);
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export declare class SkipField implements Field {
    readonly name: string;
    readonly fixedSize: number;
    constructor(name: string, size: number);
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export declare class BlobField implements Field {
    readonly name: string;
    private readonly spec;
    private readonly as;
    private readonly textDecoder?;
    private readonly textEncoder?;
    readonly fixedSize?: number;
    constructor(name: string, spec: CountSpec, as: "text" | "bytes", textDecoder?: TextDecoder | undefined, textEncoder?: TextEncoder | undefined);
    private encodeValue;
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export declare class StructField implements Field {
    readonly name: string;
    private readonly def;
    private readonly spec;
    private readonly shape;
    private readonly toEnd;
    readonly fixedSize?: number;
    constructor(name: string, def: Def, spec: CountSpec, shape: number[], toEnd?: boolean);
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export declare class VariantField implements Field {
    readonly name: string;
    private readonly keyField;
    private readonly cases;
    private readonly select?;
    readonly fixedSize: undefined;
    constructor(name: string, keyField: string, cases: {
        [key: string]: Def;
    }, select?: ((tag: any) => string | undefined) | undefined);
    private pick;
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export interface FrameReader<T = any> {
    read(c: Cursor, index: number): T | null;
}
export interface FrameWriter<T = any> {
    write(w: Writer, value: T, index: number): void;
}
export declare class FramedField<T = any> implements Field {
    readonly name: string;
    private readonly reader;
    private readonly writer;
    readonly fixedSize: undefined;
    constructor(name: string, reader: FrameReader<T>, writer: FrameWriter<T>);
    resolveLengths(obj: AnyObject, ctx: Ctx): AnyObject;
    decode(c: Cursor, out: AnyObject, ctx: Ctx, sink?: ErrorSink): void;
    encode(w: Writer, value: any, ctx: Ctx): void;
}
export type InlineDef = {
    [k: string]: any;
};
export type StructSource = StructBuffer | Def | InlineDef;
export declare function isDef(x: any): x is Def;
export interface FieldBuildCtx {
    name: string;
    parentName: string;
    le: boolean;
    textDecode?: TextDecoder;
    textEncoder?: TextEncoder;
}
export interface FieldSpec<T = any, E = T> {
    readonly __fieldSpec: true;
    readonly [VALUE_TYPE]: T;
    readonly [ENCODE_VALUE_TYPE]: E;
    build(ctx: FieldBuildCtx): Field;
}
export declare function isFieldSpec(x: any): x is FieldSpec;
export declare function normalizeDef(source: StructSource, name: string, inheritedLE: boolean, codecs?: {
    textDecode?: TextDecoder;
    textEncoder?: TextEncoder;
}): Def;
//# sourceMappingURL=field.d.ts.map
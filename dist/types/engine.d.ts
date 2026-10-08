import { Cursor } from "./cursor";
import { DecodeError } from "./errors";
import { AnyObject } from "./interfaces";
import { Writer } from "./writer";
export type Len = number | Ref | "rest" | "records";
export interface Ref {
    readonly __ref: true;
    readonly field: string;
    readonly transform?: (val: number, ctx: AnyObject) => number;
}
export declare function isRef(v: unknown): v is Ref;
export type TypeKind = "int" | "float";
interface ScalarHandle {
    get: string;
    set: string;
    isBig: boolean;
}
export declare function scalarHandle(size: number, unsigned: boolean, kind: TypeKind): ScalarHandle;
interface ScalarBase {
    size: number;
    get: string;
    set: string;
    isBig: boolean;
}
export interface ScalarNode extends ScalarBase {
    kind: "scalar";
    unsigned: boolean;
    typeKind: TypeKind;
}
export interface BitsNode extends ScalarBase {
    kind: "bits";
    positions: {
        [k: string]: number;
    };
}
export interface BitFieldsNode extends ScalarBase {
    kind: "bitFields";
    widths: {
        [k: string]: number;
    };
}
export interface BytesNode {
    kind: "bytes";
    len: Len;
}
export type PatternBytes = Uint8Array | DataView;
export interface ListSyncOptions<T = any> {
    pattern: (prev: T, first: T, all: T[], ctx: AnyObject) => PatternBytes;
    offset?: number;
}
export interface ListOptions<T = any> {
    sync?: ListSyncOptions<T>;
}
export interface ListNode {
    kind: "list";
    item: Node;
    len: Len;
    sync?: ListSyncOptions;
}
export interface FieldNode {
    name: string;
    node: Node;
}
export interface StructNode {
    kind: "struct";
    name: string;
    fields: FieldNode[];
    le?: boolean;
}
export interface VariantNode {
    kind: "variant";
    keyField: string;
    cases: {
        [key: string]: FieldNode[];
    };
    select?: (tag: any) => string | undefined;
}
export interface CodecNode {
    kind: "codec";
    fixedSize?: number;
    single?: boolean;
    read: (c: Cursor, name: string) => any;
    write: (w: Writer, v: any, name: string) => void;
}
export interface SkipNode {
    kind: "skip";
    n: number;
}
export type PatternSource = PatternBytes | ((ctx: AnyObject) => PatternBytes);
export interface SkipUntilOptions {
    offset?: number;
    optional?: boolean;
    to?: "stay" | "end";
}
export interface SkipUntilNode {
    kind: "skipUntil";
    pattern: PatternSource;
    offset?: number;
    optional?: boolean;
    to?: "stay" | "end";
}
export type Node = ScalarNode | BitsNode | BitFieldsNode | BytesNode | ListNode | StructNode | VariantNode | CodecNode | SkipNode | SkipUntilNode;
export declare function fixedSize(node: Node): number | undefined;
export declare function readNode(node: Node, c: Cursor, name: string, le: boolean, ctx: AnyObject, sink?: ErrorSink): any;
export interface ErrorSink {
    errors: DecodeError[];
    stopped: boolean;
}
export declare function decodeStruct(node: StructNode, c: Cursor, sink?: ErrorSink, inheritedLE?: boolean): AnyObject;
export declare function writeNode(node: Node, w: Writer, value: any, name: string, le: boolean, ctx: AnyObject): void;
export declare function writeStruct(node: StructNode, w: Writer, value: any, inheritedLE: boolean): void;
export {};
//# sourceMappingURL=engine.d.ts.map
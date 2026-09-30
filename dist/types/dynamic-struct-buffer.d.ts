import { DecodeBuffer_t } from "./interfaces";
import { LenientResult } from "./errors";
import { Def, Field } from "./field";
import { StructBuffer, StructBufferConfig, Type_t } from "./struct-buffer";
import { InferDef, InferEncodeDef } from "./infer";
import { Ref } from "./utils";
export type DynamicFieldType = Type_t | DynamicStructBuffer<DynamicStructDef, any, any> | {
    [k: string]: any;
};
export type DynamicStructDef = {
    [key: string]: DynamicFieldType;
};
export declare class DynamicStructBuffer<S extends DynamicStructDef = DynamicStructDef, D = InferDef<S>, E = Partial<InferEncodeDef<S>>> extends Array<DynamicStructBuffer<S, D[], E[]>> {
    readonly structName: string;
    readonly struct: S;
    deeps: (number | Ref)[];
    config: StructBufferConfig;
    readonly structKV: [string, DynamicFieldType][];
    readonly def: Def;
    constructor(structName: string, struct: S, config?: StructBufferConfig);
    get isList(): boolean;
    get count(): number;
    getCount(ctx?: any): number;
    getDeeps(ctx?: any): number[];
    private shapeOf;
    private cursor;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, parentCtx?: any): D;
    decodeLenient(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, parentCtx?: any): LenientResult<D>;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, parentCtx?: any): DataView;
    getByteLength(obj?: any, parentCtx?: any): number;
}
export declare function dynamicByteLength(type: DynamicStructBuffer | StructBuffer): number | undefined;
export type { Field, Def };
//# sourceMappingURL=dynamic-struct-buffer.d.ts.map
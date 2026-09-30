import { DecodeBuffer_t } from "./interfaces";
import { StructBufferConfig, Type_t } from "./struct-buffer";
import { Ref } from "./utils";
export type DynamicFieldType = Type_t | DynamicStructBuffer;
export type DynamicStructDef = {
    [key: string]: DynamicFieldType;
};
export declare class DynamicStructBuffer<D = {
    [key: string]: any;
}, E = Partial<D>> extends Array<DynamicStructBuffer<D[], E[]>> {
    readonly structName: string;
    readonly struct: DynamicStructDef;
    deeps: (number | Ref)[];
    config: StructBufferConfig;
    readonly structKV: [string, DynamicFieldType][];
    constructor(structName: string, struct: DynamicStructDef, config?: StructBufferConfig);
    get isList(): boolean;
    get count(): number;
    getCount(ctx?: any): number;
    getDeeps(ctx?: any): number[];
    getByteLength(obj?: any, parentCtx?: any): number;
    private _calcItemByteLength;
    decode(view: DecodeBuffer_t, littleEndian?: boolean, offset?: number, parentCtx?: any): D;
    encode(obj: E, littleEndian?: boolean, offset?: number, view?: DataView, parentCtx?: any): DataView;
}
//# sourceMappingURL=dynamic-struct-buffer.d.ts.map
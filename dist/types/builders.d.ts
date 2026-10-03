import { CountSpec, Def, Field, FieldBuildCtx, FieldSpec, FrameReader, FrameWriter, StructSource } from "./field";
import type { VARIANT_CASES } from "./class-type";
import { InferSource } from "./infer";
export declare function field<T = any, E = T>(build: (b: FieldBuildCtx) => Field): FieldSpec<T, E>;
export declare function skip(n: number): FieldSpec<never, never>;
export type BlobValue = Uint8Array | number[];
export declare function rest(): FieldSpec<Uint8Array, BlobValue>;
export declare function records<S extends StructSource>(source: S, spec?: CountSpec): FieldSpec<InferSource<S>[]>;
export declare function variant<C extends {
    [key: string]: StructSource;
}>(keyField: string, cases: C, opts?: {
    select?: (tag: any) => string | undefined;
}): VariantSpec<C>;
export interface VariantSpec<C extends {
    [key: string]: StructSource;
}> extends FieldSpec<any> {
    readonly [VARIANT_CASES]: C;
}
export declare function discriminated(name: string, keyField: string, keyType: any, cases: {
    [key: string]: StructSource;
}): {
    [k: string]: any;
};
export declare function framed<T>(reader: FrameReader<T>, writer: FrameWriter<T>): FieldSpec<T[]>;
export declare function delimited<T>(reader: FrameReader<T>, writer: FrameWriter<T>): FieldSpec<T>;
export type { Field, FieldSpec, FieldBuildCtx, StructSource, CountSpec, FrameReader, FrameWriter, Def, };
//# sourceMappingURL=builders.d.ts.map
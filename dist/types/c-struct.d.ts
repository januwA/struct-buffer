import { StructBuffer, Type_t } from "./struct-buffer";
import * as dtypes from "./types";
export interface ExpGroups {
    typedef?: string;
    struct?: string;
    structName?: string;
    props?: string;
    aliasName1?: string;
    aliasName2?: string;
}
export interface CStructProp {
    type: string;
    name: string;
    count: number;
    isList: boolean;
}
export interface CStruct {
    [propName: string]: CStructProp;
}
export declare const defaultTypes: typeof dtypes;
export declare function parse(cStructTemp: string, types?: {
    [typeName: string]: Type_t;
}): {
    [structName: string]: StructBuffer;
};
export declare function from(sb: StructBuffer): string;
//# sourceMappingURL=c-struct.d.ts.map
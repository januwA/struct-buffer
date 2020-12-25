import { StructType } from "./class-type";
import { StructBuffer } from "./struct-buffer";
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
export declare function parseCStruct(cStructTemp: string, types?: {
    [typeName: string]: StructBuffer | StructType;
}): {
    [structName: string]: StructBuffer;
};
//# sourceMappingURL=parse-cstruct.d.ts.map
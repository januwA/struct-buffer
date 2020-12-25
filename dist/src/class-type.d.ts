export declare class StructType extends Array {
    readonly size: 1 | 2 | 4 | 8;
    readonly unsigned: boolean;
    names: string[];
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    is(type: StructType): boolean;
    isName(typeName: string): boolean;
    get: string;
    set: string;
    constructor(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned: boolean);
}
export declare function registerType(typeName: string | string[], size: 1 | 2 | 4 | 8, unsigned?: boolean): StructType;
export declare function typedef(typeName: string | string[], type: StructType): StructType;
//# sourceMappingURL=class-type.d.ts.map
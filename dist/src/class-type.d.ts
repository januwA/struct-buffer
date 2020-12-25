export declare class StructType extends Array {
    readonly typeName: string;
    readonly size: 1 | 2 | 4 | 8;
    readonly unsigned: boolean;
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    is(type: StructType): boolean;
    get: string;
    set: string;
    constructor(typeName: string, size: 1 | 2 | 4 | 8, unsigned: boolean);
}
export declare function registerType(typeName: string, size: 1 | 2 | 4 | 8, unsigned?: boolean): StructType;
//# sourceMappingURL=class-type.d.ts.map
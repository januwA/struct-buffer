export declare abstract class StructType extends Array {
    abstract typeName: string;
    deeps: number[];
    get isList(): boolean;
    get count(): number;
    constructor();
}
export declare class Char extends StructType {
    typeName: string;
}
export declare class String_t extends StructType {
    typeName: string;
}
export declare class Float extends StructType {
    typeName: string;
}
export declare class Double extends StructType {
    typeName: string;
}
export declare class Int8_t extends StructType {
    typeName: string;
}
export declare class Int16_t extends StructType {
    typeName: string;
}
export declare class Int32_t extends StructType {
    typeName: string;
}
export declare class Int64_t extends StructType {
    typeName: string;
}
export declare class Byte extends StructType {
    typeName: string;
}
export declare class Word extends StructType {
    typeName: string;
}
export declare class Dword extends StructType {
    typeName: string;
}
export declare class Qword extends StructType {
    typeName: string;
}
export declare class Uint8_t extends StructType {
    typeName: string;
}
export declare class Uint16_t extends StructType {
    typeName: string;
}
export declare class Uint32_t extends StructType {
    typeName: string;
}
export declare class Uint64_t extends StructType {
    typeName: string;
}
//# sourceMappingURL=class-type.d.ts.map
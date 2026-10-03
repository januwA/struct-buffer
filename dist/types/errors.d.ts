export declare class DecodeError extends Error {
    readonly where: string;
    readonly offset: number;
    readonly need: number;
    readonly have: number;
    readonly hex: string;
    readonly name = "DecodeError";
    constructor(where: string, offset: number, need: number, have: number, hex: string);
    static reason(where: string, offset: number, reason: string): DecodeError;
}
export declare class EncodeError extends Error {
    readonly where: string;
    readonly name = "EncodeError";
    constructor(where: string, message: string);
}
export interface LenientResult<D> {
    value: D;
    errors: DecodeError[];
    consumed: number;
}
//# sourceMappingURL=errors.d.ts.map
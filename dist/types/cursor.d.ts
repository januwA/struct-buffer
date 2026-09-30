import { DecodeBuffer_t } from "./interfaces";
import { DecodeError } from "./errors";
interface CursorState {
    pos: number;
}
export declare class Cursor {
    readonly end?: number | undefined;
    readonly where: string;
    readonly view: DataView;
    private readonly st;
    constructor(view: DecodeBuffer_t, pos?: number, end?: number | undefined, where?: string, st?: CursorState);
    get pos(): number;
    set pos(v: number);
    sub(field: string): Cursor;
    get limit(): number;
    get left(): number;
    get done(): boolean;
    label(field: string): string;
    need(n: number, field: string): void;
    error(field: string, need: number): DecodeError;
    skip(n: number, field: string): void;
    u8(field: string): number;
    i8(field: string): number;
    u16(field: string, le?: boolean): number;
    i16(field: string, le?: boolean): number;
    u32(field: string, le?: boolean): number;
    i32(field: string, le?: boolean): number;
    f32(field: string, le?: boolean): number;
    f64(field: string, le?: boolean): number;
    u64(field: string, le?: boolean): number;
    bytes(n: number, field: string): Uint8Array;
    region<T>(n: number, field: string, fn: (c: Cursor) => T): T;
    peek<T>(n: number, field: string, fn: (c: Cursor) => T): {
        value: T;
        size: number;
    };
    rest(field: string): Uint8Array;
}
export {};
//# sourceMappingURL=cursor.d.ts.map
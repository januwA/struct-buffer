export declare class Writer {
    private readonly opts;
    private buf;
    private readonly start;
    private readonly fixed;
    pos: number;
    constructor(opts: {
        view?: DataView;
        offset?: number;
        littleEndian: boolean;
        capacity?: number;
    });
    get littleEndian(): boolean;
    get raw(): DataView;
    get room(): number;
    reserve(n: number): void;
    rebind(view: DataView): void;
    advance(n: number): void;
    private grow;
    u8(v: number): void;
    i8(v: number): void;
    u16(v: number): void;
    i16(v: number): void;
    u32(v: number): void;
    i32(v: number): void;
    f32(v: number): void;
    f64(v: number): void;
    u64(v: number): void;
    bytes(src: Uint8Array): void;
    zero(n: number): void;
    get written(): number;
    finish(): DataView;
}
//# sourceMappingURL=writer.d.ts.map
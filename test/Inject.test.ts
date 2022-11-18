import { StructBuffer, Inject, float, realloc } from "../src";

describe("Inject test", () => {
  let c_str: Inject;

  beforeAll(() => {
    c_str = new Inject(
      // decode
      (view: DataView, offset: number) => {
        const buf: number[] = [];
        let size = offset + 0;
        while (true) {
          let data = view.getUint8(size++);
          if (data === 0) break;
          buf.push(data);
        }

        return {
          size: size - offset,
          value: new TextDecoder().decode(new Uint8Array(buf)),
        };
      },

      // encode
      (value: string) => {
        const bytes: Uint8Array = new TextEncoder().encode(value);
        const res = realloc(bytes, bytes.byteLength + 1);
        return res;
      }
    );
  });

  it("byteLength", () => {
    expect(c_str.byteLength).toBe(0);
  });

  it("decode and encode", () => {
    const player = new StructBuffer({
      hp: float,
      name: c_str,
      mp: float,
    });

    expect(player.byteLength).toBe(8);

    // <42 c8 00 00 50 6c 61 79 65 72 31 42 c8 00 00>
    const view = player.encode({
      hp: 100.0,
      name: "Player1",
      mp: 100.0,
    });

    const obj = player.decode(view);

    expect(obj.hp).toBe(100);
    expect(obj.name).toBe("Player1");
    expect(obj.mp).toBe(100);
    expect(player.byteLength).not.toBe(8);
  });

  it("single Inject", () => {
    const view = c_str.encode("hello world");
    expect(view.getUint8(view.byteLength - 1)).toBe(0);

    const data = c_str.decode(view);
    expect(data).toBe("hello world");
  });

  it("array Inject", () => {
    const c_str_list = c_str[3];

    const view = c_str_list.encode(["a ", "bb", "c"]);
    const data = c_str_list.decode(view);
    expect(data.length).toBe(3);
    expect(data[0]).toBe("a ");
    expect(data[1]).toBe("bb");
    expect(data[2]).toBe("c");
  });
});

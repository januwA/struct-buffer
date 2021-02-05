/**
 * 设置数组嵌套层数
 * @param array
 * @param deeps
 * @param isString
 */
export function unflattenDeep(
  array: any[] | string,
  deeps: number[],
  isString = false
) {
  let r: any = array;

  if (isString && typeof r === "string") r = (r as any).split("");

  for (let i = deeps.length - 1; i >= 1; i--) {
    const isFirst = i === deeps.length - 1;
    const value = deeps[i];
    r = r.reduce((acc: any, it: any, index: number) => {
      if (index % value === 0) acc.push([]);
      acc[acc.length - 1].push(it);
      return acc;
    }, []);

    if (isString && isFirst) {
      r = r.map((it: any) => it.join(""));
    }
  }
  return r;
}

export function zeroMemory(view: DataView, length: number, offset: number) {
  while (length-- > 0) view.setUint8(offset++, 0);
}

export function createDataView(byteLength: number, view?: DataView) {
  return view ? view : new DataView(new ArrayBuffer(byteLength));
}

export function makeDataView(view: ArrayBufferView | number[]): DataView {
  if (view instanceof DataView) return view;
  if (Array.isArray(view)) view = Uint8Array.from(view);
  if (!ArrayBuffer.isView(view))
    throw new Error(`Type Error: (${view}) is not an ArrayBuffer!!!`);
  return new DataView(view.buffer);
}

export function arrayProxy(
  context: any,
  cb: (target: any, index: number) => any
) {
  return new Proxy(context, {
    get(o: any, k: string | number | symbol) {
      if (k in o) return o[k];
      if (/\d+/.test(k.toString())) return cb(o, parseInt(k as string));
    },
  });
}

/**
 * 收集index到deeps，上下文不变
 * @param context
 */
export function arrayNextProxy(context: any) {
  const proxy = arrayProxy(context, (o, i) => {
    o.deeps.push(i);
    return proxy;
  });
  return proxy;
}

/**
 * '00 01 0A' => <00 01 0A>
 * @param str
 */
export function sbytes(str: string) {
  return new DataView(
    Uint8Array.from(
      str
        .trim()
        .split(/\s+/)
        .map((it) => parseInt(it, 16))
    ).buffer
  );
}

/**
 * ```ts
 * sview([2, 0, 0, 1])
 * => 02 00 00 01
 * 
 * sview(new Uint8Array([0, 1, 10]))
 * => 00 01 0a
 * ```
 * @param view 
 */
export function sview(view: ArrayBufferView | number[]): string {
  const v = makeDataView(view);
  const lst = [];
  for (let i = 0; i < v.byteLength; i++) {
    lst.push(v.getUint8(i).toString(16).padStart(2, "0"));
  }
  return lst.join(" ");
}

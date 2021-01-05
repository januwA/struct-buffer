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
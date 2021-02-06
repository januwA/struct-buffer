import { StructType } from "./class-type";
import { IStructBuffer, StructBuffer } from "./struct-buffer";
import * as dtypes from "./types";
import { char, string_t } from "./types";

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

export const defaultTypes = dtypes;

const exp = /\s*(?<typedef>typedef)?\s*(?<struct>struct)\s*(?<structName>\w+)\s*{(?<props>[^}]*)}(\s*(?<aliasName1>\w+)?\s*,\s*(?<aliasName2>\*\w+)?\s*;\s*)?/gi;

/**
 *
 * @param cStructTemp c-struct template
 * @param types Parse the type used in the template
 */
export function parse(
  cStructTemp: string,
  types?: {
    [typeName: string]: StructBuffer<any> | StructType<any, any>;
  }
): {
  [structName: string]: StructBuffer<any>;
} {
  types = Object.assign(defaultTypes, types);

  // 去掉单行和多行注释
  cStructTemp = cStructTemp.replace(/\/\/[^]*?\n|\/\*[^]*\*\//g, "");

  const ms = [...cStructTemp.matchAll(exp)];

  if (!ms || !ms.length) throw new Error(`[parseCStruct]: parse error`);

  const cStructs: {
    [structName: string]: CStruct;
  } = {};

  // 遍历所有match
  for (const m of ms) {
    const g: ExpGroups = m.groups!;

    if (!g?.struct)
      throw new Error(`[parseCStruct]: Undefined identifier "struct"`);

    const cStructName = g?.aliasName1 ?? g?.structName;
    if (!cStructName) {
      throw new Error(`[parseCStruct]: You need to create a name for "struct"`);
    }

    const c_struct: {
      [propName: string]: CStructProp;
    } = {};

    // 解析所有属性
    if (g.props && g.props.trim()) {
      g.props
        .trim()
        .split(/\n/)
        .map((it) => {
          const propSplit = it
            .trim()
            .replace(/;$/, "")
            .split(/\s+/)
            .map((it) => it.trim());
          let name = propSplit.pop() as string;
          let type = propSplit.join(" ");
          let count = 1;
          let isList = false;

          const m = name.match(/\[(\d+)+\]/);
          if (m) {
            name = name.substr(0, m.index);
            count = parseInt(m[1]) || 1;
            isList = true;
          }

          return { type, name, count, isList };
        })
        .forEach((p) => {
          c_struct[p.name] = p;
        });
    }
    cStructs[cStructName] = c_struct;
  }

  const structBuffers: {
    [structName: string]: StructBuffer<any>;
  } = Object.keys(cStructs).reduce(
    (acc, structName) =>
      Object.assign(acc, {
        [structName]: null, // 先创建指针
      }),
    {}
  );

  for (const [structName, props] of Object.entries(cStructs)) {
    structBuffers[structName] = new StructBuffer(
      structName,
      Object.entries(props).reduce<{
        [k: string]: StructType<any, any> | StructBuffer<any>;
      }>((acc, [propName, p]) => {
        // 如果属性的type在当前解析的cStruct当中
        if (p.type in cStructs) {
          acc[propName] = structBuffers[p.type];
          return acc;
        }

        if (!types) return acc;
        let type: StructBuffer<any> | StructType<any, any> | undefined =
          types[p.type];

        if (!type) {
          type = Object.values(types).find((type) => {
            if (type instanceof StructType && type.isName(p.type)) {
              return type;
            }
            return;
          });
        }

        if (!type) {
          throw new Error(
            `[parseCStruct]: The (${p.type}) type was not found in styles`
          );
        }

        acc[propName] = p.isList ? type[p.count] : type;
        return acc;
      }, {})
    );
  }

  return structBuffers;
}

/**
 * string_t => char
 */
export function from(sb: StructBuffer<IStructBuffer>) {
  let props = "";

  for (let [propName, type] of Object.entries(sb.struct)) {
    const typeName =
      type instanceof StructType
        ? string_t.is(type)
          ? char.names[0]
          : type.names[0]
        : type.structName;

    if (type.isList) {
      const arr = type.deeps.map((i: number) => `[${i}]`).join("");
      propName = `${propName}${arr}`;
    }
    props += `\t${typeName} ${propName};\n`;
  }

  return `
typedef struct _${sb.structName}
{
${props.replace(/\n$/, "")}
} ${sb.structName}, *${sb.structName};
`;
}

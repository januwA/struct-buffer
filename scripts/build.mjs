import { readFile, rm } from "node:fs/promises";
import { build } from "esbuild";

const ENTRY = "src/index.ts";

// 目标: 产物只依赖 ECMAScript 标准本身.
//
// - `platform: "neutral"` 让 esbuild 不注入 node/browser 的 shim, 也不假设宿主
// - `format` 三选一: esm(Node/Bun/bundler/支持 ESM 的 Frida 17) / cjs(Node/Bun/老
//   bundler/CommonJS 形式的 Frida agent) / iife(浏览器 <script> 的全局变量)
// - 输出不含 `require` / `process` / `Buffer` / `global` 等宿主专有标识符
const shared = {
  entryPoints: [ENTRY],
  bundle: true,
  platform: "neutral",
  target: ["es2020"],
  charset: "utf8",
  legalComments: "none",
  logLevel: "info",
};

await rm("dist", { recursive: true, force: true });

await Promise.all([
  // ESM: 现代入口, 支持 tree-shaking
  build({
    ...shared,
    format: "esm",
    outfile: "dist/esm/index.mjs",
    sourcemap: true,
  }),
  // CJS: require() 与老 bundler 的兼容入口
  build({
    ...shared,
    format: "cjs",
    outfile: "dist/cjs/index.cjs",
    sourcemap: true,
  }),
  // IIFE: 浏览器 <script> 直接引入, 挂到全局 `StructBuffer`
  build({
    ...shared,
    format: "iife",
    globalName: "StructBuffer",
    minify: true,
    outfile: "dist/iife/struct-buffer.global.js",
    sourcemap: true,
  }),
]);

const outputs = [
  "dist/esm/index.mjs",
  "dist/cjs/index.cjs",
  "dist/iife/struct-buffer.global.js",
];

const FORBIDDEN = [
  /\brequire\s*\(/,
  /\bprocess\./,
  /\b__dirname\b/,
  /\b__filename\b/,
  /\bBuffer\b/,
  /\bwindow\b/,
  /\bself\b/,
  /\bglobal\b/,
];

for (const file of outputs) {
  const code = (await readFile(file, "utf8")).replace(/\/\/# sourceMappingURL=\S+/g, "");
  const hit = FORBIDDEN.find((re) => re.test(code));
  if (hit) {
    throw new Error(`${file} 含宿主专有标识符 ${hit} — 产物必须只依赖 ECMAScript 标准`);
  }
}

console.log(`purity ok: ${outputs.length} bundles 无宿主专有标识符`);

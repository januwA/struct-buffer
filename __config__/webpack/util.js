const path = require("path");
const fs = require("fs");

class Util {
  static tsconfig;

  /**
   * 读取 tsconfig.json的配置
   */
  getTsConfig() {
    if (Util.tsconfig) return Util.tsconfig;

    const tsConfig = fs.readFileSync(
      path.resolve(__dirname, "../../", "tsconfig.json"),
      {
        encoding: "utf-8",
      }
    );

    // 去掉注释
    Util.tsconfig = JSON.parse(
      tsConfig.replace(/\/\/[^]*?\n/g, "").replace(/[^"]\/\*[^"][^]*?\*\//g, "")
    );
    return Util.tsconfig;
  }

  /**
   * 返回项目根目录
   */
  getRootPath() {
    return path.resolve(__dirname, "../../");
  }

  /**
   * 返回打包入口文件路径
   */
  getEntryMain() {
    return path.resolve(this.getRootPath(), "src/index.ts");
  }

  getOutputPath() {
    const tsConfig = this.getTsConfig();
    const out = tsConfig ? tsConfig.compilerOptions.outDir : "dist";
    return path.resolve(this.getRootPath(), out);
  }

  /**
   * 返回[HtmlWebpackPlugin]插件的[template]配置路径
   */
  getHtmlTemplatePath() {
    return path.resolve(this.getRootPath(), "index.html");
  }

  /**
   * 解析[tsconfig.json]中的paths配置，并返回一个能在webpack中使用的[alias]
   *
   * input:
   * ```json
   * {
   * 	"compilerOptions": {
   * 		"paths": {
   * 			"~src/*": [
   * 				"./src/*"
   * 			],
   * 			"~assets/*": [
   * 				"./src/assets/*"
   * 			]
   * 		}
   * 	}
   * }
   * ```
   *
   * output:
   * ```
   * {
   *   "~src": "./src",
   *   "~assets": "./src/assets",
   * }
   * ```
   *
   * @param {} tsConfig
   */
  parseTsConfigPaths() {
    const tsConfig = this.getTsConfig();
    const { paths, baseUrl } = tsConfig.compilerOptions;
    const alias = {};
    if (paths) {
      const rootPath = this.getRootPath();
      const exp = /\/\*$/;
      for (const aliasPath in paths) {
        const key = aliasPath.replace(exp, "");
        const value = paths[aliasPath][0].replace(exp, "");
        alias[key] = path.resolve(rootPath, baseUrl, value);
      }
    }
    return alias;
  }

  /**
   *
   * @param {*} externals webpack的[externals]配置
   * @param {*} dependencies package.js中的[dependencies]字段
   */
  externals2Cdn(externals, dependencies) {
    const result = [];
    for (const libKey in externals) {
      if (libKey in dependencies) {
        const version = dependencies[libKey].replace(/^\D/, "");
        result.push(externals[libKey].cdn(version));
      }
    }
    return result;
  }
}
const util = new Util();
module.exports = util;

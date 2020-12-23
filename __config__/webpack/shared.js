const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const util = require("./util");

module.exports = {
  entry: util.getEntryMain(),
  output: {
    filename: "struct-buffer.js",
    path: util.getOutputPath(),
    library: "StructBuffer",
    libraryTarget: "umd",
    globalObject: "this",
  },

  rules: [
    {
      // See also: https://github.com/microsoft/TypeScript-Babel-Starter
      // 如果你想要.d.ts文件，那么ts-loader可能来的更直接点
      test: /\.tsx?$/,
      exclude: /(node_modules|bower_components)/,
      use: {
        loader: "ts-loader",
      },
    },
  ],
  resolve: {
    extensions: [".ts", ".js"],
  },

  // 优化: https://webpack.js.org/configuration/optimization/
  optimization: {},

  // 插件: https://webpack.js.org/configuration/plugins/#plugins
  plugins: [new CleanWebpackPlugin()],

  // 实验性支持: https://webpack.js.org/configuration/experiments/
  experiments: {
    topLevelAwait: true,
  },
};

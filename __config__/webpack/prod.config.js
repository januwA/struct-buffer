process.env.NODE_ENV = "production";
const TerserJSPlugin = require("terser-webpack-plugin");
const shared = require("./shared");

module.exports = {
  mode: process.env.NODE_ENV,
  entry: shared.entry,
  externals: shared.externals,
  module: {
    rules: shared.rules,
  },
  resolve: shared.resolve,
  optimization: {
    // 压缩js,css文件
    minimizer: [new TerserJSPlugin({})],
    // 删除空的块
    removeEmptyChunks: true,
    // 合并包含相同模块的块
    mergeDuplicateChunks: true,
  },
  plugins: [
    ...shared.plugins,
  ],
  output: shared.output,
  experiments: shared.experiments,
};

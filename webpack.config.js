const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const path = require("path");

// umd build

module.exports = {
  mode: "production",
  entry: path.resolve(__dirname, "src/index.ts"),
  output: {
    filename: "struct-buffer.js",
    path: path.resolve(__dirname, "dist/umd"),
    library: {
      name: "StructBuffer",
      type: "umd",
    },
    globalObject: "this",
  },

  module: {
    rules: [
      {
        // See also: https://github.com/microsoft/TypeScript-Babel-Starter
        // 如果你想要.d.ts文件，那么ts-loader可能来的更直接点
        test: /\.tsx?$/,
        exclude: /(node_modules|bower_components)/,
        use: {
          loader: "ts-loader",
          options: {
            configFile: path.resolve(__dirname, "tsconfig.types.json"),
          },
        },
      },
    ],
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  plugins: [new CleanWebpackPlugin()],
  experiments: { topLevelAwait: true },
};

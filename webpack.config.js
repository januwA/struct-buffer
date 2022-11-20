const path = require("path");
const { Configuration } = require("webpack");

// umd build

/** @type Configuration */
const config = {
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
    clean: true,
  },

  module: {
    rules: [
      {
        test: /\.tsx?$/,
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
  experiments: { topLevelAwait: true },
};

module.exports = config;

import path from "node:path";
import type { Configuration } from "webpack";
const root = path.resolve(import.meta.dirname, "..");
export const videoWebpack = (config: Configuration): Configuration => ({
  ...config,
  resolve: {
    ...config.resolve,
    alias: {
      ...config.resolve?.alias,
      react: path.join(root, "node_modules/react"),
      "react-dom": path.join(root, "node_modules/react-dom"),
      remotion: path.join(root, "node_modules/remotion"),
    },
  },
  module: {
    ...config.module,
    rules: [
      ...(config.module?.rules ?? []),
      {
        test: /\.tsx$/,
        include: [
          path.resolve(root, "../../src/components"),
          path.join(root, ".generated"),
        ],
        enforce: "pre",
        use: path.join(root, "scripts/asset-loader.cjs"),
      },
    ],
  },
});

import { defineConfig } from "tsdown";

const packageName = "driver.js";
const cssPath = "./dist/driver.css";

export default defineConfig({
  name: packageName,
  entry: {
    [packageName]: "./src/driver.ts",
  },
  outDir: "./dist",
  format: ["iife", "cjs", "esm"],
  target: "es2019",
  clean: true,
  dts: true,
  minify: true,
  exports: {
    customExports(exports) {
      exports[cssPath] = {
        require: cssPath,
        import: cssPath,
        default: cssPath,
      };

      return exports;
    },
  },
  outputOptions: {
    name: packageName,
    cssEntryFileNames: "driver.css",
  },
});

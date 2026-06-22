/// <reference types="vitest/config" />
import path from "path";
import { defineConfig } from "vite";

const packageName = "driver.js";

const fileName = {
  es: `${packageName}.mjs`,
  cjs: `${packageName}.cjs`,
  iife: `${packageName}.iife.js`,
};

const formats = Object.keys(fileName) as Array<keyof typeof fileName>;

export default defineConfig({
  base: "./",
  build: {
    target: "es2020",
    lib: {
      entry: path.resolve(__dirname, "src/driver.ts"),
      name: packageName,
      formats,
      fileName: format => fileName[format],
    },
    rollupOptions: {
      output: {
        assetFileNames: assetInfo => {
          const name = assetInfo.names?.[0] ?? assetInfo.name;
          return name?.endsWith(".css") ? `driver.css` : (name as string);
        },
      },
    },
  },
  test: {
    environment: "jsdom",
  },
});

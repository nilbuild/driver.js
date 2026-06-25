import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import compress from "astro-compress";

// Import the library straight from source (../src) so changes to driver.js are
// reflected instantly with HMR — no build step in between. The CSS subpath is
// aliased separately, and listed first so it matches before the bare specifier.
const driverSource = fileURLToPath(new URL("../src/driver.ts", import.meta.url));
const driverCss = fileURLToPath(new URL("../src/driver.css", import.meta.url));

// https://astro.build/config
export default defineConfig({
  site: "https://driverjs.com",
  build: {
    format: "file",
  },
  markdown: {
    // Use the pure-JS unified/remark processor instead of Astro 7's default
    // native Sätteri engine, whose prebuilt binary needs a newer glibc than
    // some build hosts provide. With this processor the native binary is never
    // loaded, so the build runs anywhere.
    processor: unified(),
    shikiConfig: {
      theme: "monokai",
    },
  },

  integrations: [
    react(),
    mdx(),
    sitemap(),
    compress({
      CSS: false,
      JS: false,
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: [
        { find: "driver.js/dist/driver.css", replacement: driverCss },
        { find: "driver.js", replacement: driverSource },
      ],
    },
    server: {
      fs: {
        // Allow importing the library source that lives outside this project.
        allow: [".."],
      },
    },
  },
});

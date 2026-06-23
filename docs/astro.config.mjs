import { defineConfig } from "astro/config";
import { unified } from "@astrojs/markdown-remark";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";

import compress from "astro-compress";

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
  },
});

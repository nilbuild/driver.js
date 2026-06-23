import { defineConfig } from "astro/config";
import tailwindcss from "@tailwindcss/vite";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";

import compress from "astro-compress";

// https://astro.build/config
export default defineConfig({
  build: {
    format: "file",
  },
  markdown: {
    shikiConfig: {
      theme: "monokai",
    },
  },

  integrations: [
    react(),
    mdx(),
    compress({
      CSS: false,
      JS: false,
    }),
  ],

  vite: {
    plugins: [tailwindcss()],
  },
});

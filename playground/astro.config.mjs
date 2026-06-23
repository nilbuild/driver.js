import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

// The playground imports the library straight from source (../src) so changes
// to driver.js are reflected instantly with HMR — no build step in between.
const driverSource = fileURLToPath(new URL("../src/driver.ts", import.meta.url));

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        "driver.js": driverSource,
      },
    },
    server: {
      fs: {
        // Allow importing the library source that lives outside this project.
        allow: [".."],
      },
    },
  },
});

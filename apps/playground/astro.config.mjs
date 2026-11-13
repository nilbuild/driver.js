import { defineConfig } from "astro/config";
import { fileURLToPath } from "node:url";
import tailwindcss from "@tailwindcss/vite";

// The playground imports the library straight from source (../src) so changes
// to driver.js are reflected instantly with HMR — no build step in between.
const driverSource = fileURLToPath(new URL("../../packages/driver/src/driver.ts", import.meta.url));
const hintsSource = fileURLToPath(new URL("../../packages/driver/src/hints.ts", import.meta.url));
const checklistSource = fileURLToPath(new URL("../../packages/driver/src/checklist.ts", import.meta.url));
const headlessSource = fileURLToPath(new URL("../../packages/driver/src/headless.ts", import.meta.url));

// https://astro.build/config
export default defineConfig({
  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        // The subpath has to come first: aliases match on prefix, so a
        // "driver.js" entry would otherwise rewrite "driver.js/hints" too.
        "driver.js/hints": hintsSource,
        "driver.js/checklist": checklistSource,
        "driver.js/headless": headlessSource,
        "driver.js": driverSource,
      },
    },
    server: {
      watch: {
        // Test files are not part of the app: without this, saving a spec
        // reloads every open page, including the ones a test run is driving.
        ignored: ["**/e2e/**", "**/test-results/**", "**/playwright.config.ts"],
      },
      fs: {
        // Allow importing the library source that lives outside this project.
        allow: ["../.."],
      },
    },
  },
});

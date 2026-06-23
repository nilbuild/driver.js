import { copyFileSync } from "node:fs";

// vite-plugin-dts emits a single bundled declaration file. Copy it to the
// ESM/CJS-specific extensions so each `exports` condition resolves to types
// that match its module format (avoids the "types masquerade as CJS" issue).
const source = "dist/driver.js.d.ts";
copyFileSync(source, "dist/driver.js.d.mts");
copyFileSync(source, "dist/driver.js.d.cts");

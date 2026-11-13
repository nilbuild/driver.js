import { copyFileSync } from "node:fs";

// tsdown emits per-format declarations (.d.mts/.d.cts) natively; the plain
// .d.ts copies exist only for the top-level `types` fields, which legacy
// node10 resolution (and hints/ and checklist/package.json) still points at.
copyFileSync("dist/driver.js.d.mts", "dist/driver.js.d.ts");
copyFileSync("dist/hints.d.mts", "dist/hints.d.ts");
copyFileSync("dist/checklist.d.mts", "dist/checklist.d.ts");
copyFileSync("dist/headless.d.mts", "dist/headless.d.ts");

import { describe, expect, it } from "vitest";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

// The overlay SVG is mounted inside the rAF loop, so every assertion waits a
// frame before reading the rendered path.
const overlayPath = () => document.querySelector<SVGPathElement>(".driver-overlay path");

describe("overlay configuration", () => {
  it("paints the overlay with the configured colour", async () => {
    const d = createDriver({ animate: false, overlayColor: "rgb(255, 0, 0)", steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(overlayPath()?.style.fill).toBe("rgb(255, 0, 0)");
  });

  it("falls back to the default black overlay colour", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    // jsdom normalises the "#000" default to rgb form.
    expect(overlayPath()?.style.fill).toBe("rgb(0, 0, 0)");
  });

  it("applies the configured overlay opacity", async () => {
    const d = createDriver({ animate: false, overlayOpacity: 0.4, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(overlayPath()?.style.opacity).toBe("0.4");
  });

  it("rounds the cutout corners by the configured stage radius", async () => {
    const d = createDriver({ animate: false, stageRadius: 8, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    // The rounded-corner arcs in the path use the normalised radius.
    expect(overlayPath()?.getAttribute("d")).toContain("a8,8");
  });

  it("insets the cutout by the configured stage padding", async () => {
    // Element box is 0×0 in jsdom, so with padding 20 and the default radius 5
    // the cutout's leading corner sits at (-20 + 5, -20) = (-15, -20).
    const d = createDriver({ animate: false, stagePadding: 20, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(overlayPath()?.getAttribute("d")).toContain("M-15,-20");
  });
});

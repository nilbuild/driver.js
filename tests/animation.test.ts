import { describe, expect, it } from "vitest";
import { createDriver, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

// The library drives the CSS fade via a custom property on <body> so a single
// `duration` config controls both the JS stage slide and the CSS fade-in.
const cssDuration = () => document.body.style.getPropertyValue("--driver-animation-duration");

describe("animation duration", () => {
  it("defaults to 400ms", () => {
    const d = createDriver({ steps: SAMPLE_STEPS });

    expect(d.getConfig().duration).toBe(400);
  });

  it("respects a custom duration via config", () => {
    const d = createDriver({ duration: 1200, steps: SAMPLE_STEPS });

    expect(d.getConfig().duration).toBe(1200);
  });

  it("exposes the duration to CSS as a custom property while driving", () => {
    const d = createDriver({ duration: 1200, steps: SAMPLE_STEPS });
    d.drive();

    expect(cssDuration()).toBe("1200ms");
  });

  it("falls back to the default on the custom property when duration is not set", () => {
    const d = createDriver({ steps: SAMPLE_STEPS });
    d.drive();

    expect(cssDuration()).toBe("400ms");
  });

  it("clears the custom property when the tour is destroyed", () => {
    const d = createDriver({ duration: 1200, steps: SAMPLE_STEPS });
    d.drive();
    d.destroy();

    expect(cssDuration()).toBe("");
  });
});

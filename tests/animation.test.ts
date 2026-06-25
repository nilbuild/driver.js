import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

// Advances the rAF loop until the predicate holds or the frame budget runs out.
// The animated stage transition settles over several frames, so polling beats a
// fixed wait.
async function flushFrames(predicate: () => boolean, maxFrames = 120): Promise<void> {
  for (let i = 0; i < maxFrames; i++) {
    if (predicate()) {
      return;
    }
    await nextFrame();
  }
  throw new Error("condition not met within frame budget");
}

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

describe("animated stage transition", () => {
  it("runs the rAF stage transition and settles on the next step", async () => {
    const onHighlighted = vi.fn();
    const d = createDriver({ animate: true, duration: 30, steps: SAMPLE_STEPS, onHighlighted });
    d.drive();

    await flushFrames(() => onHighlighted.mock.calls.length >= 1);
    expect(d.getActiveIndex()).toBe(0);

    d.moveNext();

    // Drives transitionStage/easeInOutQuad across frames until step 2 settles.
    await flushFrames(() => onHighlighted.mock.calls.length >= 2);

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
    expect(d.getState("__activeStep")?.popover?.title).toBe("Step 2");
  });
});

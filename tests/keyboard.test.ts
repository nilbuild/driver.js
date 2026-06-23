import { describe, expect, it } from "vitest";
import { createDriver, nextFrame, popoverTitle, pressKey, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("keyboard control", () => {
  it("closes the tour when Escape is pressed", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(false);
  });

  it("ignores Escape when allowClose is false", () => {
    const d = createDriver({ animate: false, allowClose: false, steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(true);
  });

  it("navigates with the arrow keys", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    // Arrow handlers no-op mid-transition, so let the highlight settle first.
    await nextFrame();

    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");

    pressKey("ArrowLeft");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);
  });

  it("does not close the tour when ArrowLeft is pressed on the first step", async () => {
    const d = createDriver({ animate: false, allowClose: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowLeft");
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores keys when allowKeyboardControl is false", () => {
    const d = createDriver({ animate: false, allowKeyboardControl: false, steps: SAMPLE_STEPS });
    d.drive();

    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(0);

    pressKey("Escape");
    expect(d.isActive()).toBe(true);
  });
});

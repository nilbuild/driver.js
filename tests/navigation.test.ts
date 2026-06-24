import { describe, expect, it } from "vitest";
import { createDriver, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("tour navigation", () => {
  it("starts at the first step", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(d.getActiveIndex()).toBe(0);
    expect(d.isFirstStep()).toBe(true);
    expect(d.isLastStep()).toBe(false);
    expect(d.hasPreviousStep()).toBeFalsy();
    expect(d.hasNextStep()).toBeTruthy();
    expect(popoverTitle()).toBe("Step 1");
  });

  it("can start at a given index", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
  });

  it("moves to the next and previous steps", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    d.moveNext();
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");

    d.movePrevious();
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");
  });

  it("detects the last step", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    d.moveTo(2);

    expect(d.getActiveIndex()).toBe(2);
    expect(d.isLastStep()).toBe(true);
    expect(d.hasNextStep()).toBeFalsy();
    expect(popoverTitle()).toBe("Step 3");
  });

  it("exposes the next step", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(d.getNextStep()?.popover?.title).toBe("Step 2");

    d.moveTo(SAMPLE_STEPS.length - 1);
    expect(d.getNextStep()).toBeUndefined();
  });

  it("destroys the tour when moving next past the last step", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(SAMPLE_STEPS.length - 1);

    d.moveNext();

    expect(d.isActive()).toBe(false);
  });

  it("destroys the tour when moving previous before the first step", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    d.movePrevious();

    expect(d.isActive()).toBe(false);
  });

  it("destroys the tour when moving to an out-of-range index", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    d.moveTo(99);

    expect(d.isActive()).toBe(false);
  });

  it("exposes the active and previous step and element", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();

    expect(d.getActiveStep()?.popover?.title).toBe("Step 2");
    expect(d.getPreviousStep()?.popover?.title).toBe("Step 1");
    expect(d.getActiveElement()).toBe(document.querySelector("#card-1"));
    expect(d.getPreviousElement()).toBe(document.querySelector("#intro"));
  });
});

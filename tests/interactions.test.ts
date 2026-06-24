import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

function clickOverlay(): void {
  document.querySelector(".driver-overlay path")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

describe("button interactions", () => {
  it("advances when the next button is clicked", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    navButton("next")?.click();

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
  });

  it("goes back when the previous button is clicked", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);
    navButton("prev")?.click();

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");
  });

  it("closes the tour when the close button is clicked", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    navButton("close")?.click();

    expect(d.isActive()).toBe(false);
  });

  it("runs onNextClick instead of auto-advancing when provided", () => {
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onNextClick });
    d.drive();
    navButton("next")?.click();

    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("runs onPrevClick instead of going back when provided", () => {
    const onPrevClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onPrevClick });
    d.drive(1);
    navButton("prev")?.click();

    expect(onPrevClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("runs onNextClick when overlayClickBehavior is 'nextStep'", async () => {
    const onNextClick = vi.fn();
    const d = createDriver({
      animate: false,
      overlayClickBehavior: "nextStep",
      steps: SAMPLE_STEPS,
      onNextClick,
    });
    d.drive();
    await nextFrame();

    clickOverlay();

    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("supports a step-level onNextClick override", () => {
    const onNextClick = vi.fn();
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1", onNextClick } },
        { element: "#card-1", popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    navButton("next")?.click();

    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("runs onDoneClick instead of onNextClick on the final step", () => {
    const onDoneClick = vi.fn();
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDoneClick, onNextClick });
    d.drive(SAMPLE_STEPS.length - 1);
    navButton("next")?.click();

    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(onNextClick).not.toHaveBeenCalled();

    const [element, step, options] = onDoneClick.mock.calls[0];
    expect(element).toBe(document.querySelector(".feature-list"));
    expect(step.popover?.title).toBe("Step 3");
    expect(options.driver).toBe(d);
  });

  it("leaves teardown to onDoneClick instead of auto-destroying", () => {
    const onDoneClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDoneClick });
    d.drive(SAMPLE_STEPS.length - 1);
    navButton("next")?.click();

    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);
  });

  it("does not fire onDoneClick on non-final steps", () => {
    const onDoneClick = vi.fn();
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDoneClick, onNextClick });
    d.drive();
    navButton("next")?.click();

    expect(onDoneClick).not.toHaveBeenCalled();
    expect(onNextClick).toHaveBeenCalledTimes(1);
  });

  it("supports a step-level onDoneClick override", () => {
    const onDoneClick = vi.fn();
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#card-1", popover: { title: "Step 2", onDoneClick } },
      ],
    });
    d.drive(1);
    navButton("next")?.click();

    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);
  });
});

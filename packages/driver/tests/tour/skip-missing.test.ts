import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, popoverTitle, useDriverHarness } from "../utils";

useDriverHarness();

const STEPS = [
  { element: "#intro", popover: { title: "Step 1" } },
  { element: "#missing", popover: { title: "Step 2" } },
  { element: "#card-1", popover: { title: "Step 3" } },
];

describe("skipMissingElement", () => {
  it("skips a step whose element is missing when moving forward", () => {
    const d = createDriver({ animate: false, skipMissingElement: true, steps: STEPS });
    d.drive();
    expect(popoverTitle()).toBe("Step 1");

    d.moveNext();
    expect(popoverTitle()).toBe("Step 3");
    expect(d.getActiveIndex()).toBe(2);
  });

  it("skips a step whose element is missing when moving backward", () => {
    const d = createDriver({ animate: false, skipMissingElement: true, steps: STEPS });
    d.drive(2);
    expect(popoverTitle()).toBe("Step 3");

    d.movePrevious();
    expect(popoverTitle()).toBe("Step 1");
    expect(d.getActiveIndex()).toBe(0);
  });

  it("skips a missing first step on initial drive", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [{ element: "#missing", popover: { title: "Step 1" } }, ...STEPS.slice(2)],
    });
    d.drive();
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 3");
  });

  it("does not skip when the option is off (shows the centered popover)", () => {
    const d = createDriver({ animate: false, steps: STEPS });
    d.drive();
    d.moveNext();

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
  });

  it("never skips an intentional element-less step", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { popover: { title: "Centered" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Centered");
  });

  it("honours a step-level skipMissingElement over the driver default", () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#missing", skipMissingElement: true, popover: { title: "Step 2" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(d.getActiveIndex()).toBe(2);
    expect(popoverTitle()).toBe("Step 3");
  });

  it("ends the tour when the remaining forward steps are all missing", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#missing", popover: { title: "Step 2" } },
        { element: "#missing-too", popover: { title: "Step 3" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(d.isActive()).toBe(false);
  });

  it("shows the done button on the last reachable step when the steps after it are missing", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#card-1", popover: { title: "Step 2" } },
        { element: "#missing", popover: { title: "Step 3" } },
      ],
    });
    d.drive(1);

    expect(navButton("next")?.textContent).toBe("Done");
    expect(navButton("next")?.classList.contains("driver-popover-done-btn")).toBe(true);
    expect(d.isLastStep()).toBe(true);
    expect(d.hasNextStep()).toBe(false);
    expect(d.getNextStep()).toBeUndefined();
  });

  it("runs onDoneClick on the last reachable step when the steps after it are missing", () => {
    const onDoneClick = vi.fn();
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      onDoneClick,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#missing", popover: { title: "Step 2" } },
      ],
    });
    d.drive();

    navButton("next")?.click();
    expect(onDoneClick).toHaveBeenCalledTimes(1);
  });

  it("disables the previous button on the first reachable step when the steps before it are missing", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#missing", popover: { title: "Step 1" } },
        { element: "#intro", popover: { title: "Step 2" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive();

    expect(d.getActiveIndex()).toBe(1);
    expect(navButton("prev")?.disabled).toBe(true);
    expect(d.isFirstStep()).toBe(true);
    expect(d.hasPreviousStep()).toBe(false);
  });

  it("skips missing steps in the middle without treating the current step as last", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: STEPS,
    });
    d.drive();

    expect(navButton("next")?.textContent).toBe("Next");
    expect(d.isLastStep()).toBe(false);
    expect(d.hasNextStep()).toBe(true);
    expect(d.getNextStep()?.popover?.title).toBe("Step 3");
  });

  it("stays put when moving backward finds no earlier present step", () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#missing", popover: { title: "Step 1" } },
        { element: "#missing-too", popover: { title: "Step 2" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive(2);
    expect(d.getActiveIndex()).toBe(2);

    d.movePrevious();
    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(2);
    expect(popoverTitle()).toBe("Step 3");
  });
});

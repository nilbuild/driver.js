import { describe, expect, it } from "vitest";
import { createDriver, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("configuration & state", () => {
  it("returns the active configuration via getConfig", () => {
    const d = createDriver({ animate: false, stagePadding: 12 });

    expect(d.getConfig().animate).toBe(false);
    expect(d.getConfig().stagePadding).toBe(12);
  });

  it("updates configuration via setConfig", () => {
    const d = createDriver({ animate: false });
    d.setConfig({ animate: false, stagePadding: 25 });

    expect(d.getConfig().stagePadding).toBe(25);
  });

  it("replaces the steps via setSteps", () => {
    const d = createDriver({ animate: false });
    d.setSteps([{ element: "#card-1", popover: { title: "Replaced" } }]);
    d.drive();

    expect(popoverTitle()).toBe("Replaced");
    expect(d.isLastStep()).toBe(true);
  });

  it("exposes the documented state shape via getState", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(d.getState("isInitialized")).toBe(true);
    expect(d.getState("activeIndex")).toBe(0);

    const state = d.getState();
    expect(state.activeStep?.popover?.title).toBe("Step 1");
    expect(state.activeElement).toBe(document.querySelector("#intro"));
  });

  it("refreshes an active highlight without throwing", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(() => d.refresh()).not.toThrow();
    expect(d.isActive()).toBe(true);
  });
});

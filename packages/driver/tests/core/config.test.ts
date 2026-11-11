import { afterEach, describe, expect, it } from "vitest";
import { driver, type Driver } from "../../src/driver";
import { createDriver, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

const extra: Driver[] = [];
function track(d: Driver): Driver {
  extra.push(d);
  return d;
}
afterEach(() => {
  while (extra.length) {
    extra.pop()?.destroy();
  }
});

describe("configuration", () => {
  it("lets user config override the defaults and keeps the rest", () => {
    const config = createDriver({ animate: false, stagePadding: 25, overlayColor: "#fff" }).getConfig();

    expect(config.animate).toBe(false);
    expect(config.stagePadding).toBe(25);
    expect(config.overlayColor).toBe("#fff");
    expect(config.duration).toBe(400);
  });

  it("replaces the config wholesale on setConfig, re-applying defaults", () => {
    const d = createDriver({ animate: false, stagePadding: 25, popoverClass: "mine", steps: SAMPLE_STEPS });

    d.setConfig({ duration: 100 });

    expect(d.getConfig().duration).toBe(100);
    expect(d.getConfig().animate).toBe(true);
    expect(d.getConfig().stagePadding).toBe(10);
    expect(d.getConfig().popoverClass).toBeUndefined();
    expect(d.getConfig().steps).toBeUndefined();
  });

  it("replaces the steps via setSteps, which is inert until drive()", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.setSteps([{ element: "#card-1", popover: { title: "Replaced" } }]);

    expect(d.isActive()).toBe(false);
    expect(d.getConfig().steps).toHaveLength(1);

    d.drive();

    expect(popoverTitle()).toBe("Replaced");
    expect(d.isLastStep()).toBe(true);
  });
});

describe("per-instance isolation (#571)", () => {
  it("keeps config and setConfig changes scoped to one instance", () => {
    const d1 = track(driver({ animate: false, stagePadding: 1 }));
    const d2 = track(driver({ animate: false, stagePadding: 2 }));

    expect(d1.getConfig().stagePadding).toBe(1);
    expect(d2.getConfig().stagePadding).toBe(2);

    d1.setConfig({ animate: false, stagePadding: 10 });

    expect(d1.getConfig().stagePadding).toBe(10);
    expect(d2.getConfig().stagePadding).toBe(2);
  });

  it("keeps steps and setSteps scoped to one instance", () => {
    const d1 = track(driver({ animate: false, steps: [{ element: "#intro", popover: { title: "D1 Step" } }] }));
    const d2 = track(driver({ animate: false, steps: [{ element: "#card-1", popover: { title: "D2 Step" } }] }));

    d2.setSteps([{ element: "#card-1", popover: { title: "D2 only" } }]);
    d1.drive();

    expect(popoverTitle()).toBe("D1 Step");

    d1.setSteps([{ element: "#intro", popover: { title: "D1 only" } }]);
    d1.drive();

    expect(popoverTitle()).toBe("D1 only");
  });

  it("keeps each instance's active state independent", () => {
    const d1 = track(driver({ animate: false, steps: SAMPLE_STEPS }));
    const d2 = track(driver({ animate: false, steps: SAMPLE_STEPS }));

    d1.drive();
    d1.moveNext();

    expect(d2.isActive()).toBe(false);
    expect(d2.getActiveIndex()).toBeUndefined();
  });

  it("passes each instance's own driver into its hooks", async () => {
    const seen: Driver[] = [];
    const d1 = track(
      driver({
        animate: false,
        steps: [
          {
            element: "#intro",
            popover: { title: "D1" },
            onHighlighted: (_element, _step, opts) => seen.push(opts.driver),
          },
        ],
      })
    );
    track(driver({ animate: false, steps: SAMPLE_STEPS }));

    d1.drive();
    await nextFrame();

    expect(seen[0]).toBe(d1);
  });
});

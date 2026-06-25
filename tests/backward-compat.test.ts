import { afterEach, describe, expect, it, vi } from "vitest";
import { driver, type Driver } from "../src/driver";
import { nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

// This file is a safety net for the planned per-instance refactor (issue #571).
//
// Part 1 pins the public API contract that MUST keep working no matter how the
// internals change — defaults, return shapes, navigation, lifecycle, callbacks.
// These are the real backward-compatibility guarantees; they should stay green
// through the refactor.
//
// Part 2 characterises the CURRENT, shared-global behaviour that issue #571 is
// about. These assertions intentionally encode today's (buggy) singleton
// semantics so the baseline is green. When the refactor lands, these are the
// tests we flip — they become the proof that the fix changed what it should and
// nothing else.

useDriverHarness();

// The shared harness only tracks a single driver; multi-instance tests create
// several, so track and tear them all down here.
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

describe("backward compatibility — single instance public API", () => {
  it("applies the documented default configuration", () => {
    const config = track(driver()).getConfig();

    expect(config.animate).toBe(true);
    expect(config.duration).toBe(400);
    expect(config.allowClose).toBe(true);
    expect(config.allowScroll).toBe(true);
    expect(config.overlayClickBehavior).toBe("close");
    expect(config.overlayOpacity).toBe(0.7);
    expect(config.smoothScroll).toBe(false);
    expect(config.disableActiveInteraction).toBe(false);
    expect(config.showProgress).toBe(false);
    expect(config.stagePadding).toBe(10);
    expect(config.stageRadius).toBe(5);
    expect(config.popoverOffset).toBe(10);
    expect(config.showButtons).toEqual(["next", "previous", "close"]);
    expect(config.disableButtons).toEqual([]);
    expect(config.overlayColor).toBe("#000");
  });

  it("lets user config override the defaults", () => {
    const config = track(driver({ animate: false, stagePadding: 25, overlayColor: "#fff" })).getConfig();

    expect(config.animate).toBe(false);
    expect(config.stagePadding).toBe(25);
    expect(config.overlayColor).toBe("#fff");
    // Untouched defaults remain.
    expect(config.duration).toBe(400);
  });

  it("reports inert query results before drive() is called", () => {
    const d = track(driver({ animate: false, steps: SAMPLE_STEPS }));

    expect(d.isActive()).toBe(false);
    expect(d.getActiveIndex()).toBeUndefined();
    expect(d.getActiveStep()).toBeUndefined();
    expect(d.getActiveElement()).toBeUndefined();
    expect(d.isFirstStep()).toBe(false);
    expect(d.isLastStep()).toBe(false);
    expect(d.hasNextStep()).toBe(false);
    expect(d.hasPreviousStep()).toBe(false);
  });

  it("activates and exposes the active step after drive()", () => {
    const d = track(driver({ animate: false, steps: SAMPLE_STEPS }));
    d.drive();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
    expect(d.isFirstStep()).toBe(true);
    expect(d.isLastStep()).toBe(false);
    expect(d.getActiveStep()?.popover?.title).toBe("Step 1");
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
    expect(popoverTitle()).toBe("Step 1");
  });

  it("navigates forward and backward through the steps", () => {
    const d = track(driver({ animate: false, steps: SAMPLE_STEPS }));
    d.drive();

    d.moveNext();
    expect(d.getActiveIndex()).toBe(1);
    expect(d.hasPreviousStep()).toBe(true);
    expect(d.hasNextStep()).toBe(true);
    expect(popoverTitle()).toBe("Step 2");

    d.moveTo(2);
    expect(d.getActiveIndex()).toBe(2);
    expect(d.isLastStep()).toBe(true);
    expect(d.hasNextStep()).toBe(false);

    d.movePrevious();
    expect(d.getActiveIndex()).toBe(1);
    expect(d.hasPreviousStep()).toBe(true);
  });

  it("updates config and steps in place via setConfig / setSteps", () => {
    const d = track(driver({ animate: false }));

    d.setConfig({ animate: false, stagePadding: 30 });
    expect(d.getConfig().stagePadding).toBe(30);

    d.setSteps([{ element: "#card-1", popover: { title: "Only" } }]);
    d.drive();
    expect(popoverTitle()).toBe("Only");
    expect(d.isLastStep()).toBe(true);
  });

  it("highlights a single element without a steps array", () => {
    const d = track(driver({ animate: false }));
    d.highlight({ element: "#intro", popover: { title: "Solo" } });

    expect(d.isActive()).toBe(true);
    expect(popoverTitle()).toBe("Solo");
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
  });

  it("tears down DOM and state on destroy()", () => {
    const d = track(driver({ animate: false, steps: SAMPLE_STEPS }));
    d.drive();
    expect(document.querySelector(".driver-popover")).not.toBeNull();
    expect(document.body.classList.contains("driver-active")).toBe(true);

    d.destroy();

    expect(d.isActive()).toBe(false);
    expect(document.querySelector(".driver-popover")).toBeNull();
    expect(document.body.classList.contains("driver-active")).toBe(false);
    expect(d.getActiveStep()).toBeUndefined();
  });

  it("passes config, state and driver into lifecycle hooks", async () => {
    const onHighlighted = vi.fn();
    const d = track(
      driver({
        animate: false,
        steps: [{ element: "#intro", popover: { title: "Hooked" }, onHighlighted }],
      })
    );
    d.drive();
    // onHighlighted settles in the animation-frame loop.
    await nextFrame();

    expect(onHighlighted).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onHighlighted.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(step.popover?.title).toBe("Hooked");
    expect(opts.driver).toBe(d);
    expect(opts.config.animate).toBe(false);
    expect(opts.state.activeIndex).toBe(0);
  });
});

describe("per-instance isolation (#571) — desired behaviour, currently failing", () => {
  // These are forward specs for the per-instance refactor, written as the
  // behaviour we WANT. They use `it.fails`, so today they pass precisely because
  // the assertion fails against the current shared-global implementation. When
  // the refactor lands and isolation works, each spec will start passing, which
  // makes `it.fails` fail — that's the signal to drop `.fails` and lock the
  // behaviour in as a regular regression test.

  it.fails("gives each instance its own config", () => {
    const d1 = track(driver({ animate: false, stagePadding: 1 }));
    const d2 = track(driver({ animate: false, stagePadding: 2 }));

    expect(d1.getConfig().stagePadding).toBe(1);
    expect(d2.getConfig().stagePadding).toBe(2);
  });

  it.fails("drives each instance's own steps", () => {
    const d1 = track(driver({ animate: false, steps: [{ element: "#intro", popover: { title: "D1 Step" } }] }));
    track(driver({ animate: false, steps: [{ element: "#card-1", popover: { title: "D2 Step" } }] }));

    d1.drive();

    expect(popoverTitle()).toBe("D1 Step");
  });

  it.fails("keeps each instance's active state independent", () => {
    const d1 = track(driver({ animate: false, steps: SAMPLE_STEPS }));
    const d2 = track(driver({ animate: false, steps: SAMPLE_STEPS }));

    d1.drive();
    d1.moveNext();

    expect(d2.isActive()).toBe(false);
    expect(d2.getActiveIndex()).toBeUndefined();
  });
});

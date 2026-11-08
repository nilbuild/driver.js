import { afterEach, describe, expect, it } from "vitest";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const isPopoverNudged = () => !!popoverEl()?.classList.contains("driver-popover-nudge");

async function start(config: Parameters<typeof createDriver>[0] = {}) {
  const d = createDriver({ animate: false, steps: SAMPLE_STEPS, ...config });
  d.drive();
  await nextFrame();
  return d;
}

describe("nudge", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--driver-nudge-duration");
  });

  it("shakes the popover", async () => {
    const d = await start();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("never touches the highlighted element itself", async () => {
    const d = await start();
    const element = document.querySelector("#intro")!;
    const before = element.getAttribute("class");

    d.nudge();

    expect(element.getAttribute("class")).toBe(before);
    expect(element.getAttribute("style")).toBeNull();
  });

  it("clears itself when the animation ends", async () => {
    const d = await start();

    d.nudge();
    popoverEl()?.dispatchEvent(new Event("animationend"));

    expect(isPopoverNudged()).toBe(false);
  });

  it("clears itself after the duration when no animation runs", async () => {
    document.documentElement.style.setProperty("--driver-nudge-duration", "40ms");
    const d = await start();

    d.nudge();
    await tick(300);

    expect(isPopoverNudged()).toBe(false);
  });

  it("restarts instead of stacking", async () => {
    const d = await start();

    d.nudge();
    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("shakes the popover of a centered step", async () => {
    const d = createDriver({ animate: false, steps: [{ popover: { title: "Centered" } }] });
    d.drive();
    await nextFrame();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("does nothing without an active tour", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });

    expect(() => d.nudge()).not.toThrow();
  });

  it("is cleaned up on destroy", async () => {
    const d = await start();
    d.nudge();
    d.destroy();

    expect(popoverEl()).toBeNull();
  });
});

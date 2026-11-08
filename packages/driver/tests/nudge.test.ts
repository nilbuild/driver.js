import { afterEach, describe, expect, it } from "vitest";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const ring = () => document.querySelector(".driver-overlay .driver-nudge-ring");
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

  it("shakes the popover and rings the element by default", async () => {
    const d = await start();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
    expect(ring()).not.toBeNull();
  });

  it("can target only the popover", async () => {
    const d = await start();

    d.nudge("popover");

    expect(isPopoverNudged()).toBe(true);
    expect(ring()).toBeNull();
  });

  it("can target only the element", async () => {
    const d = await start();

    d.nudge("element");

    expect(isPopoverNudged()).toBe(false);
    expect(ring()).not.toBeNull();
    expect(ring()?.getAttribute("d")).toMatch(/^M/);
  });

  it("never touches the highlighted element itself", async () => {
    const d = await start();
    const element = document.querySelector("#intro")!;
    const before = element.getAttribute("class");

    d.nudge("element");

    expect(element.getAttribute("class")).toBe(before);
    expect(element.getAttribute("style")).toBeNull();
  });

  it("clears itself when the animation ends", async () => {
    const d = await start();

    d.nudge();
    popoverEl()?.dispatchEvent(new Event("animationend"));
    ring()?.dispatchEvent(new Event("animationend"));

    expect(isPopoverNudged()).toBe(false);
    expect(ring()).toBeNull();
  });

  it("clears itself after the duration when no animation runs", async () => {
    document.documentElement.style.setProperty("--driver-nudge-duration", "40ms");
    const d = await start();

    d.nudge();
    await tick(300);

    expect(isPopoverNudged()).toBe(false);
    expect(ring()).toBeNull();
  });

  it("restarts instead of stacking", async () => {
    const d = await start();

    d.nudge();
    d.nudge();

    expect(isPopoverNudged()).toBe(true);
    expect(document.querySelectorAll(".driver-nudge-ring")).toHaveLength(1);
  });

  it("follows the element when the overlay refreshes", async () => {
    const d = await start();
    d.nudge("element");
    const before = ring()?.getAttribute("d");

    Object.defineProperty(window, "innerWidth", { value: window.innerWidth + 100, configurable: true });
    const element = document.querySelector("#intro") as HTMLElement;
    element.getBoundingClientRect = () => ({ x: 50, y: 60, width: 30, height: 20, top: 60, left: 50, right: 80, bottom: 80, toJSON: () => ({}) });
    d.refresh();
    await nextFrame();

    expect(ring()?.getAttribute("d")).not.toBe(before);
  });

  it("skips the ring for a centered step", async () => {
    const d = createDriver({ animate: false, steps: [{ popover: { title: "Centered" } }] });
    d.drive();
    await nextFrame();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
    expect(ring()).toBeNull();
  });

  it("does nothing without an active tour", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });

    expect(() => d.nudge()).not.toThrow();
  });

  it("is cleaned up on destroy", async () => {
    const d = await start();
    d.nudge();
    d.destroy();

    expect(ring()).toBeNull();
    expect(popoverEl()).toBeNull();
  });
});

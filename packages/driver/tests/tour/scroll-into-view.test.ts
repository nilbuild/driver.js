import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

let scrolled: Element[];

beforeEach(() => {
  scrolled = [];
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this);
  };
  vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 5000, 100, 20));

  return () => vi.restoreAllMocks();
});

const scrolledIds = () => scrolled.map(element => element.id || element.className);

describe("scrollIntoView", () => {
  it("scrolls the element and the popover into view by default", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(scrolledIds()).toContain("intro");
    expect(scrolledIds().some(name => name.includes("driver-popover"))).toBe(true);
  });

  it("does not scroll anything when turned off", async () => {
    const d = createDriver({ animate: false, scrollIntoView: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();

    expect(scrolled).toEqual([]);
  });

  it("can be turned off for one step", async () => {
    const d = createDriver({
      animate: false,
      steps: [SAMPLE_STEPS[0], { ...SAMPLE_STEPS[1], scrollIntoView: false }],
    });
    d.drive();
    await nextFrame();
    scrolled = [];
    d.moveNext();
    await nextFrame();

    expect(scrolled).toEqual([]);
  });

  it("can be turned back on for one step", async () => {
    const d = createDriver({
      animate: false,
      scrollIntoView: false,
      steps: [SAMPLE_STEPS[0], { ...SAMPLE_STEPS[1], scrollIntoView: true }],
    });
    d.drive();
    await nextFrame();
    expect(scrolled).toEqual([]);

    d.moveNext();
    await nextFrame();
    expect(scrolledIds()).toContain("card-1");
  });
});

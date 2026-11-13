import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

let scrolled: Element[];
let scrollArgs: Map<string, ScrollIntoViewOptions | boolean | undefined>;

beforeEach(() => {
  scrolled = [];
  scrollArgs = new Map();
  Element.prototype.scrollIntoView = function (this: Element, arg?: ScrollIntoViewOptions | boolean) {
    scrolled.push(this);
    scrollArgs.set(this.id || this.className, arg);
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

  it("puts the element where block and inline say, and the rest where it always goes", async () => {
    const d = createDriver({ animate: false, scrollIntoView: { inline: "nearest" }, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    expect(scrollArgs.get("intro")).toMatchObject({ inline: "nearest", block: "center" });
  });

  it("takes block and inline per step", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ ...SAMPLE_STEPS[0], scrollIntoView: { block: "start" } }],
    });
    d.drive();
    await nextFrame();

    expect(scrollArgs.get("intro")).toMatchObject({ inline: "center", block: "start" });
  });

  it("scrolls the popover only as far as it takes", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    const popover = [...scrollArgs.entries()].find(entry => entry[0].includes("driver-popover"));
    expect(popover?.[1]).toMatchObject({ inline: "nearest", block: "nearest" });
  });
});

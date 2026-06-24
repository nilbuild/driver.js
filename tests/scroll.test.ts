import { describe, expect, it } from "vitest";
import { createDriver, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const hasNoScroll = () => document.body.classList.contains("driver-no-scroll");

describe("allowScroll", () => {
  it("allows body scrolling by default", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(d.getConfig().allowScroll).toBe(true);
    expect(hasNoScroll()).toBe(false);
  });

  it("locks body scrolling when allowScroll is false", () => {
    const d = createDriver({ animate: false, allowScroll: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(hasNoScroll()).toBe(true);
  });

  it("locks body scrolling for a tour when allowScroll is false", () => {
    const d = createDriver({ animate: false, allowScroll: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(hasNoScroll()).toBe(true);
  });

  it("releases the scroll lock on destroy", () => {
    const d = createDriver({ animate: false, allowScroll: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });
    d.destroy();

    expect(hasNoScroll()).toBe(false);
  });
});

import { describe, expect, it, vi } from "vitest";
import { createDriver, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const hasNoScroll = () => document.body.classList.contains("driver-no-scroll");

// Forces #intro out of view and spies on its scrollIntoView so the chosen
// scroll behavior can be asserted. jsdom reports a 0×0 box that always counts as
// in-view, so without this the library never scrolls.
function spyOnScrollIntoView(): ReturnType<typeof vi.fn> {
  const el = document.querySelector<HTMLElement>("#intro")!;
  el.getBoundingClientRect = () =>
    ({ top: -500, left: 0, right: 0, bottom: -480, width: 0, height: 0, x: 0, y: 0, toJSON() {} }) as DOMRect;
  const scrollIntoView = vi.fn();
  el.scrollIntoView = scrollIntoView;
  return scrollIntoView;
}

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

describe("smoothScroll", () => {
  it("scrolls instantly by default", () => {
    const scrollIntoView = spyOnScrollIntoView();
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "auto" });
  });

  it("scrolls smoothly when smoothScroll is enabled", () => {
    const scrollIntoView = spyOnScrollIntoView();
    const d = createDriver({ animate: false, smoothScroll: true });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.calls[0][0]).toMatchObject({ behavior: "smooth" });
  });
});

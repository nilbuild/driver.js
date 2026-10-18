import { describe, expect, it, vi } from "vitest";
import { bringInView } from "../src/utils";
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

describe("scroll containers", () => {
  const rect = (top: number, height: number) =>
    ({ top, bottom: top + height, left: 0, right: 100, width: 100, height, x: 0, y: top, toJSON() {} }) as DOMRect;

  function mountBox(itemTop: number, itemStyle = "") {
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="box" style="overflow: auto"><div id="item" style="${itemStyle}">Item</div></div>`
    );
    const box = document.querySelector<HTMLElement>("#box")!;
    const item = document.querySelector<HTMLElement>("#item")!;
    box.getBoundingClientRect = () => rect(200, 300);
    item.getBoundingClientRect = () => rect(itemTop, 50);
    const scrollIntoView = vi.fn();
    item.scrollIntoView = scrollIntoView;
    return { item, scrollIntoView };
  }

  it("scrolls an element clipped by its scroll container, though it is inside the viewport", () => {
    const { item, scrollIntoView } = mountBox(550);

    bringInView(item);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("scrolls an element scrolled above its scroll container", () => {
    const { item, scrollIntoView } = mountBox(100);

    bringInView(item);

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("leaves an element alone when it is visible inside its scroll container", () => {
    const { item, scrollIntoView } = mountBox(300);

    bringInView(item);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("ignores scroll containers above a fixed element, which they do not clip", () => {
    const { item, scrollIntoView } = mountBox(550, "position: fixed");

    bringInView(item);

    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("scrolls the next step clipped by the container the previous step locked", () => {
    document.head.insertAdjacentHTML(
      "beforeend",
      `<style id="lock">.driver-active-element-parent-no-scroll { overflow: hidden !important; }</style>`
    );
    const { item, scrollIntoView } = mountBox(300);
    item.insertAdjacentHTML("afterend", `<div id="next">Next</div>`);
    const next = document.querySelector<HTMLElement>("#next")!;
    next.getBoundingClientRect = () => rect(550, 50);
    const nextScrollIntoView = vi.fn();
    next.scrollIntoView = nextScrollIntoView;

    const d = createDriver({ animate: false, steps: [{ element: "#item" }, { element: "#next" }] });
    d.drive();
    expect(document.querySelector("#box")!.classList.contains("driver-active-element-parent-no-scroll")).toBe(true);
    expect(getComputedStyle(document.querySelector("#box")!).overflow).toBe("hidden");
    d.moveNext();
    document.querySelector("#lock")!.remove();

    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(nextScrollIntoView).toHaveBeenCalledTimes(1);
  });

  it("scrolls a tour step clipped by its scroll container", () => {
    const { scrollIntoView } = mountBox(550);

    const d = createDriver({ animate: false });
    d.highlight({ element: "#item", popover: { title: "Item" } });

    expect(scrollIntoView).toHaveBeenCalledTimes(1);
  });
});

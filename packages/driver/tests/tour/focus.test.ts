import { beforeEach, describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, useDriverHarness } from "../utils";

useDriverHarness();

const liveRegion = () => document.querySelector(".driver-live-region")?.textContent;

beforeEach(() => {
  // jsdom lays nothing out, so nothing would count as visible (and focusable)
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(10);
  document.body.insertAdjacentHTML(
    "beforeend",
    `<form id="form"><label>Name <input id="name"></label></form><div id="text">Plain text</div><button id="page">Elsewhere</button>`
  );
  return () => vi.restoreAllMocks();
});

const focusedId = () => (document.activeElement as HTMLElement | null)?.id;
const step = (element: string, extra: object = {}) => ({
  element,
  popover: { title: "Name", description: "Type it" },
  ...extra,
});

describe("focus", () => {
  it("puts the keyboard on the popover by default", async () => {
    createDriver({ animate: false, steps: [step("#form")] }).drive();
    await nextFrame();

    expect(document.activeElement).toBe(navButton("next"));
  });

  it("puts it in the element with 'element', and still reads the popover out", async () => {
    createDriver({ animate: false, focus: "element", steps: [step("#form")] }).drive();
    await nextFrame();

    expect(focusedId()).toBe("name");
    expect(liveRegion()).toContain("Type it");
  });

  it("falls back to the popover when there is nothing to use in the element", async () => {
    createDriver({ animate: false, steps: [step("#text", { focus: "element" })] }).drive();
    await nextFrame();
    expect(document.activeElement).toBe(navButton("next"));
  });

  it("falls back to the popover when the element can't be used", async () => {
    createDriver({
      animate: false,
      steps: [step("#form", { focus: "element", disableActiveInteraction: true })],
    }).drive();
    await nextFrame();
    expect(document.activeElement).toBe(navButton("next"));
  });

  it("focuses the element of a step without a popover", async () => {
    createDriver({ animate: false, focus: "element", steps: [{ element: "#form" }] }).drive();
    await nextFrame();
    expect(focusedId()).toBe("name");
  });

  it("leaves the keyboard where it is with 'none'", async () => {
    (document.getElementById("page") as HTMLElement).focus();
    createDriver({ animate: false, focus: "none", steps: [step("#form")] }).drive();
    await nextFrame();

    expect(focusedId()).toBe("page");
    expect(liveRegion()).toContain("Type it");
  });
});

describe("focus when the tour ends", () => {
  it("goes back where it was when the tour had it", async () => {
    (document.getElementById("page") as HTMLElement).focus();
    const d = createDriver({ animate: false, steps: [step("#form")] });
    d.drive();
    await nextFrame();
    expect(document.activeElement).toBe(navButton("next"));

    d.destroy();
    expect(focusedId()).toBe("page");
  });

  it("stays where the user put it", async () => {
    (document.getElementById("page") as HTMLElement).focus();
    const d = createDriver({ animate: false, focus: "element", steps: [step("#form")] });
    d.drive();
    await nextFrame();
    expect(focusedId()).toBe("name");

    d.destroy();
    expect(focusedId()).toBe("name");
  });
});

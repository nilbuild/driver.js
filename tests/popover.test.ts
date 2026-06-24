import { describe, expect, it } from "vitest";
import type { Alignment, Side } from "../src/popover";
import { createDriver, navButton, nextFrame, popoverEl, progressText, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

describe("popover rendering", () => {
  it("shows no buttons for a bare highlight", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(navButton("close")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-footer")?.style.display).toBe("none");
  });

  it("renders the navigation buttons for a tour", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("next")?.style.display).toBe("block");
    expect(navButton("prev")?.style.display).toBe("block");
    expect(navButton("close")?.style.display).toBe("block");
  });

  it("honours a step-level showButtons override across a tour", () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1", showButtons: ["next"] } },
        { element: "#card-1", popover: { title: "Step 2" } },
        { element: ".feature-list", popover: { title: "Step 3" } },
      ],
    });
    d.drive();

    expect(navButton("next")?.style.display).toBe("block");
    expect(navButton("prev")?.style.display).toBe("none");

    d.moveTo(1);
    expect(navButton("next")?.style.display).toBe("block");
    expect(navButton("prev")?.style.display).toBe("block");

    d.moveTo(2);
    expect(navButton("prev")?.style.display).toBe("block");
  });

  it("honours an explicit showButtons list", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["close"] } });

    expect(navButton("close")?.style.display).toBe("block");
    expect(navButton("next")?.style.display).not.toBe("block");
  });

  it("disables buttons listed in disableButtons", () => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", showButtons: ["next", "close"], disableButtons: ["next"] },
    });

    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("next")?.classList.contains("driver-popover-btn-disabled")).toBe(true);
  });

  it("uses custom button text", () => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", showButtons: ["next", "previous"], nextBtnText: "Onward", prevBtnText: "Back" },
    });

    expect(navButton("next")?.innerHTML).toBe("Onward");
    expect(navButton("prev")?.innerHTML).toBe("Back");
  });

  it("renders progress text when enabled", () => {
    const d = createDriver({ animate: false, showProgress: true, steps: SAMPLE_STEPS });
    d.drive();

    expect(progressText()).toBe("1 of 3");
  });

  it("formats a custom progress template", () => {
    const d = createDriver({
      animate: false,
      showProgress: true,
      progressText: "{{current}}/{{total}}",
      steps: SAMPLE_STEPS,
    });
    d.drive();

    expect(progressText()).toBe("1/3");
  });

  it("marks the next button as done on the last step only", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("next")?.classList.contains("driver-popover-done-btn")).toBe(false);

    d.moveTo(SAMPLE_STEPS.length - 1);

    expect(navButton("next")?.classList.contains("driver-popover-done-btn")).toBe(true);
  });

  it("applies a custom popover class", () => {
    const d = createDriver({ animate: false, popoverClass: "my-custom-popover" });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(popoverEl()?.classList.contains("my-custom-popover")).toBe(true);
  });

  it("defaults to the bottom side", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(popoverEl()?.classList.contains("driver-popover-side-bottom")).toBe(true);
  });

  it("exposes the rendered side and alignment as classes", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", side: "bottom", align: "center" } });

    expect(popoverEl()?.classList.contains("driver-popover-side-bottom")).toBe(true);
    expect(popoverEl()?.classList.contains("driver-popover-align-center")).toBe(true);
  });

  it("reflects the flipped side rather than the configured one", () => {
    const d = createDriver({ animate: false });
    // There is no room above a zero-height element, so the popover flips away from "top".
    d.highlight({ element: "#intro", popover: { title: "Intro", side: "top" } });

    expect(popoverEl()?.classList.contains("driver-popover-side-top")).toBe(false);
  });

  it("clears stale side classes when the popover is repositioned", async () => {
    const rect = (over: Partial<DOMRect>): DOMRect =>
      ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

    const el = document.querySelector<HTMLElement>("#intro")!;

    // Plenty of room above the element, so it renders on "top".
    el.getBoundingClientRect = () => rect({ top: 300, left: 400, right: 600, bottom: 320, width: 200, height: 20 });

    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", side: "top" } });

    expect(popoverEl()?.classList.contains("driver-popover-side-top")).toBe(true);

    // No room above and only room below, so it flips to "bottom" on refresh.
    el.getBoundingClientRect = () => rect({ top: 0, left: 5, right: 1020, bottom: 5, width: 1015, height: 5 });
    d.refresh();
    await nextFrame();

    const sideClasses = [...popoverEl()!.classList].filter(className => className.startsWith("driver-popover-side-"));
    expect(sideClasses).toEqual(["driver-popover-side-bottom"]);
  });

  it("allows mutating the popover from onPopoverRender", () => {
    const d = createDriver({
      animate: false,
      onPopoverRender: popover => {
        const extra = document.createElement("button");
        extra.classList.add("my-extra-btn");
        popover.footerButtons.appendChild(extra);
      },
    });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(document.querySelector(".driver-popover .my-extra-btn")).not.toBeNull();
  });
});

describe("popover arrow", () => {
  const rect = (over: Partial<DOMRect>): DOMRect =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

  const arrowEl = () => document.querySelector<HTMLElement>(".driver-popover-arrow")!;

  // jsdom doesn't lay anything out, so we feed both the element and the popover
  // their boxes, then refresh to run the positioning against those boxes.
  function positionArrow(opts: {
    side: Side;
    align?: Alignment;
    element: Partial<DOMRect>;
    popover: Partial<DOMRect>;
  }): Promise<void> {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect(opts.element);
    // jsdom has no scrollIntoView; off-screen element boxes would otherwise throw.
    el.scrollIntoView = () => {};

    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", side: opts.side, align: opts.align ?? "start" } });

    const wrapper = popoverEl() as HTMLElement;
    wrapper.getBoundingClientRect = () => rect(opts.popover);

    d.refresh();
    return nextFrame();
  }

  it("points the arrow at the element's vertical center for a left/right placement", async () => {
    // Element sits to the right with its vertical center at y=230; popover box
    // spans top=100..400. The arrow's tip should land at 230 - 100 = 130, so the
    // 10px arrow box starts at 125.
    await positionArrow({
      side: "left",
      element: { top: 200, left: 800, right: 900, bottom: 260, width: 100, height: 60 },
      popover: { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 },
    });

    expect(arrowEl().classList.contains("driver-popover-arrow-side-left")).toBe(true);
    expect(arrowEl().style.top).toBe("125px");
    expect(arrowEl().style.left).toBe("");
  });

  it("points the arrow at the element's horizontal center for a top/bottom placement", async () => {
    // Element center x=400; popover box spans left=250..550. Tip at 400 - 250 =
    // 150, arrow box starts at 145.
    await positionArrow({
      side: "bottom",
      element: { top: 50, left: 300, right: 500, bottom: 80, width: 200, height: 30 },
      popover: { top: 100, left: 250, right: 550, bottom: 250, width: 300, height: 150 },
    });

    expect(arrowEl().classList.contains("driver-popover-arrow-side-bottom")).toBe(true);
    expect(arrowEl().style.left).toBe("145px");
    expect(arrowEl().style.top).toBe("");
  });

  it("clamps the arrow to the popover's bounds when the element center is past its edge", async () => {
    // Element still overlaps the popover vertically (380..400) but its center is
    // well below, so the arrow clamps to the bottom inset: 300 - 15 - 10 = 275.
    await positionArrow({
      side: "left",
      element: { top: 380, left: 800, right: 900, bottom: 700, width: 100, height: 320 },
      popover: { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 },
    });

    expect(arrowEl().classList.contains("driver-popover-arrow-side-left")).toBe(true);
    expect(arrowEl().style.top).toBe("275px");
  });

  it("flips the arrow to point up when the element scrolls above a side-placed popover", async () => {
    // The element has scrolled clear above the popover. The arrow should leave
    // the side edge and sit on the top edge pointing up (side "bottom"), offset
    // horizontally toward the element instead of clamping to a side corner.
    await positionArrow({
      side: "right",
      element: { top: -150, left: 800, right: 900, bottom: -50, width: 100, height: 100 },
      popover: { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 },
    });

    expect(arrowEl().classList.contains("driver-popover-arrow-side-bottom")).toBe(true);
    expect(arrowEl().style.left).not.toBe("");
    expect(arrowEl().style.top).toBe("");
  });

  // When the element spans the whole popover edge the arrow has slack, so it
  // follows the configured alignment. Popover height is 300, inset 15, arrow 10:
  // start → 15, center → 145, end → 275.
  it.each([
    ["start", "15px"],
    ["center", "145px"],
    ["end", "275px"],
  ] as const)("aligns the arrow to %s when the element spans the whole popover edge", async (align, expected) => {
    await positionArrow({
      side: "left",
      align,
      element: { top: 50, left: 800, right: 900, bottom: 700, width: 100, height: 650 },
      popover: { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 },
    });

    expect(arrowEl().style.top).toBe(expected);
  });

  it("ignores align for a small element and tracks its center", async () => {
    // The element doesn't span the popover, so align: "end" is overridden and
    // the arrow points at the element's center (y=230 → 130 → box at 125).
    await positionArrow({
      side: "left",
      align: "end",
      element: { top: 200, left: 800, right: 900, bottom: 260, width: 100, height: 60 },
      popover: { top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 },
    });

    expect(arrowEl().style.top).toBe("125px");
  });

  it("clamps the arrow to the leading inset when the element center is before the popover", async () => {
    // Element still overlaps the popover horizontally (250..270) but its center
    // is near the leading edge, so the arrow clamps to the 15px inset.
    await positionArrow({
      side: "bottom",
      element: { top: 50, left: 230, right: 270, bottom: 80, width: 40, height: 30 },
      popover: { top: 100, left: 250, right: 550, bottom: 250, width: 300, height: 150 },
    });

    expect(arrowEl().classList.contains("driver-popover-arrow-side-bottom")).toBe(true);
    expect(arrowEl().style.left).toBe("15px");
  });

  it("hides the arrow for a free-floating (over) popover", () => {
    const d = createDriver({ animate: false });
    d.highlight({ popover: { title: "Floating" } });

    expect(arrowEl().classList.contains("driver-popover-arrow-none")).toBe(true);
    expect([...arrowEl().classList].some(c => c.startsWith("driver-popover-arrow-side-"))).toBe(false);
  });

  it("clears the inline offset when the popover flips to an over/none placement", async () => {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect({ top: 200, left: 800, right: 900, bottom: 260, width: 100, height: 60 });

    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", side: "left" } });

    const wrapper = popoverEl() as HTMLElement;
    wrapper.getBoundingClientRect = () =>
      rect({ top: 100, left: 600, right: 800, bottom: 400, width: 200, height: 300 });
    d.refresh();
    await nextFrame();
    expect(arrowEl().style.top).not.toBe("");

    // No room on any side now, so the popover detaches and the arrow is hidden
    // with its stale offset cleared.
    el.getBoundingClientRect = () => rect({ top: 0, left: 0, right: 1024, bottom: 768, width: 1024, height: 768 });
    d.refresh();
    await nextFrame();

    expect(arrowEl().classList.contains("driver-popover-arrow-none")).toBe(true);
    expect(arrowEl().style.top).toBe("");
  });
});

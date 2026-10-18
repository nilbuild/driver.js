import { describe, expect, it, vi } from "vitest";
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

  it("labels the close button Close by default", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(navButton("close")?.getAttribute("aria-label")).toBe("Close");
  });

  it("uses closeBtnLabel from the config", () => {
    const d = createDriver({ animate: false, closeBtnLabel: "Fermer" });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(navButton("close")?.getAttribute("aria-label")).toBe("Fermer");
  });

  it("lets a step override closeBtnLabel", () => {
    const d = createDriver({ animate: false, closeBtnLabel: "Fermer" });
    d.highlight({ element: "#intro", popover: { title: "Intro", closeBtnLabel: "Schließen" } });

    expect(navButton("close")?.getAttribute("aria-label")).toBe("Schließen");
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

  it("interpolates a step-level progress template", () => {
    const d = createDriver({
      animate: false,
      showProgress: true,
      steps: [
        { element: "#intro", popover: { title: "Step 1", progressText: "{{current}} localized text {{total}} done" } },
        { element: "#card-1", popover: { title: "Step 2" } },
        { element: ".feature-list", popover: { title: "Step 3" } },
      ],
    });
    d.drive();

    expect(progressText()).toBe("1 localized text 3 done");
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

describe("popover config fallbacks", () => {
  it("falls back to the global button texts when the step sets none", () => {
    const d = createDriver({ animate: false, nextBtnText: "Global Next", prevBtnText: "Global Prev" });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["next", "previous"] } });

    expect(navButton("next")?.innerHTML).toBe("Global Next");
    expect(navButton("prev")?.innerHTML).toBe("Global Prev");
  });

  it("uses the global button texts on intermediate tour steps", () => {
    const d = createDriver({ animate: false, nextBtnText: "Global Next", steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("next")?.innerHTML).toBe("Global Next");
  });

  it("narrows the tour buttons to the global showButtons", () => {
    const d = createDriver({ animate: false, showButtons: ["next"], steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("next")?.style.display).toBe("block");
    expect(navButton("prev")?.style.display).toBe("none");
    expect(navButton("close")?.style.display).toBe("none");
  });

  it("prefers a step-level popoverClass over the global one", () => {
    const d = createDriver({ animate: false, popoverClass: "global-theme" });
    d.highlight({ element: "#intro", popover: { title: "Intro", popoverClass: "step-theme" } });

    expect(popoverEl()?.classList.contains("step-theme")).toBe(true);
    expect(popoverEl()?.classList.contains("global-theme")).toBe(false);
  });

  it("prefers a step-level onPopoverRender over the global one", () => {
    const globalRender = vi.fn();
    const stepRender = vi.fn();
    const d = createDriver({ animate: false, onPopoverRender: globalRender });
    d.highlight({ element: "#intro", popover: { title: "Intro", onPopoverRender: stepRender } });

    expect(stepRender).toHaveBeenCalledTimes(1);
    expect(globalRender).not.toHaveBeenCalled();
  });

  it("applies the global disableButtons on a bare highlight", () => {
    const d = createDriver({ animate: false, disableButtons: ["next"] });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["next"] } });

    expect(navButton("next")?.disabled).toBe(true);
  });

  it("applies the global disableButtons during a tour", () => {
    const d = createDriver({ animate: false, disableButtons: ["next"], steps: SAMPLE_STEPS });
    d.drive(1);

    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("prev")?.disabled).toBe(false);
  });

  it("still disables previous on the first step with a global disableButtons", () => {
    const d = createDriver({ animate: false, disableButtons: ["close"], steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("prev")?.disabled).toBe(true);
    expect(navButton("close")?.disabled).toBe(true);
    expect(navButton("next")?.disabled).toBe(false);
  });

  it("lets a step's disableButtons replace the global one", () => {
    const d = createDriver({
      animate: false,
      disableButtons: ["next"],
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#card-1", popover: { title: "Step 2", disableButtons: [] } },
      ],
    });
    d.drive(1);

    expect(navButton("next")?.disabled).toBe(false);
  });

  it("hides the close button in a tour when allowClose is false", () => {
    const d = createDriver({ animate: false, allowClose: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("close")?.style.display).toBe("none");
    expect(navButton("next")?.style.display).toBe("block");
  });

  it("honours a step-level showProgress override", () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1", showProgress: true } },
        { element: "#card-1", popover: { title: "Step 2" } },
      ],
    });
    d.drive();

    expect(progressText()).toBe("1 of 2");
    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")?.style.display).toBe("block");
  });
});

describe("popover accessibility contract", () => {
  it("renders the popover as a labelled dialog", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", description: "Description" } });

    const wrapper = popoverEl() as HTMLElement;
    expect(wrapper.id).toBe("driver-popover-content");
    expect(wrapper.getAttribute("role")).toBe("dialog");
    expect(wrapper.getAttribute("aria-labelledby")).toBe("driver-popover-title");
    expect(wrapper.getAttribute("aria-describedby")).toBe("driver-popover-description");
    expect(document.getElementById("driver-popover-title")).not.toBeNull();
    expect(document.getElementById("driver-popover-description")).not.toBeNull();
  });

  it("hides the title element when only a description is given", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { description: "Only description" } });

    expect(document.querySelector<HTMLElement>(".driver-popover-title")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-description")?.style.display).toBe("block");
  });
});

describe("popover state exposure", () => {
  it("exposes the rendered popover DOM through getState", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    const popover = d.getState("popover");
    expect(popover?.wrapper).toBe(popoverEl());
    expect(popover?.nextButton).toBe(navButton("next"));
    expect(popover?.title.textContent).toBe("Intro");
  });

  it("exposes the rendered popover through state inside onPopoverRender", () => {
    // The hook receives the popover as its first argument, but opts.state
    // must agree with it — code in the wild reads opts.state.popover too.
    let stateMatchesArg: boolean | undefined;
    const d = createDriver({
      animate: false,
      onPopoverRender: (popover, opts) => {
        stateMatchesArg = opts.state.popover === popover;
      },
    });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(stateMatchesArg).toBe(true);
  });

  it("clears the popover from state on destroy", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });
    d.destroy();

    expect(d.getState("popover")).toBeUndefined();
  });
});

describe("popover interaction edge cases", () => {
  it("disables the close button when close is in disableButtons", () => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", showButtons: ["close"], disableButtons: ["close"] },
    });

    expect(navButton("close")?.disabled).toBe(true);
    expect(navButton("close")?.classList.contains("driver-popover-btn-disabled")).toBe(true);
  });

  it("emits without navigating when next/prev are clicked on a bare highlight", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["next", "previous"] } });

    navButton("next")?.click();
    navButton("prev")?.click();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
  });

  it("lets links inside the description behave normally", () => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", description: '<a class="doc-link" href="#doc">Docs</a>' },
    });

    document.querySelector<HTMLElement>(".doc-link")?.click();

    expect(d.isActive()).toBe(true);
  });

  it("repositions the popover when a lazy image inside it finishes loading", () => {
    let lazyImage: HTMLImageElement | undefined;
    const d = createDriver({
      animate: false,
      onPopoverRender: popover => {
        lazyImage = document.createElement("img");
        Object.defineProperty(lazyImage, "complete", { value: false });
        popover.description.appendChild(lazyImage);
      },
    });
    d.highlight({ element: "#intro", popover: { title: "Intro", description: "With image" } });

    expect(() => lazyImage?.dispatchEvent(new Event("load"))).not.toThrow();
    expect(popoverEl()).not.toBeNull();
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

describe("done button text", () => {
  it("labels the final step's next button 'Done' by default", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(SAMPLE_STEPS.length - 1);

    expect(navButton("next")?.innerHTML).toBe("Done");
  });

  it("uses a custom doneBtnText on the final step", () => {
    const d = createDriver({ animate: false, doneBtnText: "Finish", steps: SAMPLE_STEPS });
    d.drive(SAMPLE_STEPS.length - 1);

    expect(navButton("next")?.innerHTML).toBe("Finish");
  });

  it("prefers a step-level doneBtnText over the global one", () => {
    const d = createDriver({
      animate: false,
      doneBtnText: "Global Done",
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#card-1", popover: { title: "Step 2", doneBtnText: "Step Done" } },
      ],
    });
    d.drive(1);

    expect(navButton("next")?.innerHTML).toBe("Step Done");
  });
});

describe("popover offset", () => {
  const rect = (over: Partial<DOMRect>): DOMRect =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

  // Places a top-positioned popover with the given offset and returns its
  // resolved top coordinate. Asserting the *difference* between two offsets
  // tests the feature (offset distances the popover from the element) without
  // hard-coding the full positioning formula.
  async function topForOffset(popoverOffset: number): Promise<number> {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect({ top: 400, left: 400, right: 600, bottom: 420, width: 200, height: 20 });
    el.scrollIntoView = () => {};

    const d = createDriver({ animate: false, popoverOffset });
    d.highlight({ element: "#intro", popover: { title: "Intro", side: "top" } });

    const wrapper = popoverEl() as HTMLElement;
    wrapper.getBoundingClientRect = () => rect({});
    d.refresh();
    await nextFrame();

    const top = parseFloat(wrapper.style.top);
    d.destroy();
    return top;
  }

  it("moves the popover further from the element as the offset grows", async () => {
    const near = await topForOffset(10);
    const far = await topForOffset(50);

    // A top-placed popover sits above the element, so a larger offset yields a
    // smaller top — further away by exactly the offset delta.
    expect(near - far).toBe(40);
  });
});

describe("popover click target", () => {
  it("handles clicks whose target is a text node", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", description: "Some text" } });

    const errors: unknown[] = [];
    const onError = (e: ErrorEvent) => errors.push(e.error);
    window.addEventListener("error", onError);

    const text = document.querySelector(".driver-popover-description")!.firstChild!;
    text.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

    window.removeEventListener("error", onError);
    expect(errors).toEqual([]);
  });
});

describe("popover landmarks", () => {
  it("renders the title and footer without header or footer landmarks", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(popoverEl()?.querySelector("header, footer")).toBeNull();
    expect(popoverEl()?.querySelector(".driver-popover-title")?.tagName).toBe("DIV");
    expect(popoverEl()?.querySelector(".driver-popover-footer")?.tagName).toBe("DIV");
  });
});

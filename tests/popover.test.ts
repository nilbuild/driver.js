import { describe, expect, it } from "vitest";
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

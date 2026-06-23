import { describe, expect, it } from "vitest";
import { createDriver, navButton, popoverEl, progressText, SAMPLE_STEPS, useDriverHarness } from "./utils";

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

  it("applies a custom popover class", () => {
    const d = createDriver({ animate: false, popoverClass: "my-custom-popover" });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(popoverEl()?.classList.contains("my-custom-popover")).toBe(true);
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

import { describe, expect, it } from "vitest";
import { createDriver, navButton, nextFrame, popoverEl, progressText, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

describe("popover rendering", () => {
  it("honours an explicit showButtons list", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["close"] } });

    expect(navButton("close")?.style.display).toBe("");
    expect(navButton("next")?.style.display).not.toBe("block");
  });

  it.each(["next", "close"] as const)("disables the %s button listed in disableButtons", name => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", showButtons: ["next", "close"], disableButtons: [name] },
    });

    expect(navButton(name)?.disabled).toBe(true);
    expect(navButton(name)?.classList.contains("driver-popover-btn-disabled")).toBe(true);
  });

  it("marks the next button as done on the last step only", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(navButton("next")?.classList.contains("driver-popover-done-btn")).toBe(false);

    d.moveTo(SAMPLE_STEPS.length - 1);

    expect(navButton("next")?.classList.contains("driver-popover-done-btn")).toBe(true);
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
  it("applies the global disableButtons on a bare highlight", () => {
    const d = createDriver({ animate: false, disableButtons: ["next"] });
    d.highlight({ element: "#intro", popover: { title: "Intro", showButtons: ["next"] } });

    expect(navButton("next")?.disabled).toBe(true);
  });

  it("lets a step turn progress on or off against the config (A4)", () => {
    const d = createDriver({
      animate: false,
      showProgress: true,
      steps: [
        { element: "#intro", popover: { title: "One", showProgress: false } },
        { element: "#card-1", popover: { title: "Two" } },
      ],
    });
    d.drive();

    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")!.style.display).toBe("none");

    d.moveNext();

    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")!.style.display).toBe("");
    expect(progressText()).toBe("2 of 2");

    d.setConfig({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "One", showProgress: true } },
        { element: "#card-1", popover: { title: "Two" } },
      ],
    });
    d.drive();

    expect(progressText()).toBe("1 of 2");
    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")!.style.display).toBe("");
  });

  it("keeps the navigation for a tour step without a popover, hiding the empty title and description", () => {
    const d = createDriver({ animate: false, steps: [{ element: "#intro" }, SAMPLE_STEPS[1]] });
    d.drive();

    expect(document.querySelector<HTMLElement>(".driver-popover-title")!.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-description")!.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-footer")!.style.display).toBe("");
    expect(navButton("next")?.style.display).toBe("");
  });
});

describe("popover title", () => {
  it("hides the title element when only a description is given", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { description: "Only description" } });

    expect(document.querySelector<HTMLElement>(".driver-popover-title")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-description")?.style.display).toBe("");
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
  it("lets links inside the description behave normally", () => {
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Intro", description: '<a class="doc-link" href="#doc">Docs</a>' },
    });

    document.querySelector<HTMLElement>(".doc-link")?.click();

    expect(d.isActive()).toBe(true);
  });
});

describe("highlight() buttons without a hook", () => {
  it("do nothing, as there is no step to move to", async () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Solo", showButtons: ["next", "previous", "close"] } });
    await nextFrame();

    navButton("next")!.click();
    navButton("prev")!.click();
    expect(d.isActive()).toBe(true);
    expect(document.querySelector(".driver-popover-title")?.textContent).toBe("Solo");

    navButton("close")!.click();
    expect(d.isActive()).toBe(false);
  });

  it("do not resume a tour whose index is still around", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();
    d.highlight({ element: "#intro", popover: { title: "Solo", showButtons: ["next", "previous"] } });
    await nextFrame();

    navButton("next")!.click();
    navButton("prev")!.click();
    await nextFrame();

    expect(document.querySelector(".driver-popover-title")?.textContent).toBe("Solo");
    expect(d.getActiveIndex()).toBe(1);
  });

  it("still navigate on a tour step whose onNextClick is explicitly undefined", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#intro", popover: { title: "One", onNextClick: undefined } }, SAMPLE_STEPS[1]],
    });
    d.drive();
    await nextFrame();

    navButton("next")!.click();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("run the popover's own hooks", async () => {
    const calls: string[] = [];
    const d = createDriver({ animate: false });
    d.highlight({
      element: "#intro",
      popover: {
        title: "Solo",
        showButtons: ["next", "previous", "close"],
        onNextClick: () => calls.push("next"),
        onPrevClick: () => calls.push("previous"),
        onCloseClick: () => calls.push("close"),
      },
    });
    await nextFrame();
    navButton("next")!.click();
    navButton("prev")!.click();
    navButton("close")!.click();

    expect(calls).toEqual(["next", "previous", "close"]);
    expect(d.isActive()).toBe(true);
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

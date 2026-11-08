import { describe, expect, it, vi } from "vitest";
import {
  createDriver,
  navButton,
  nextFrame,
  popoverDescription,
  popoverEl,
  popoverTitle,
  SAMPLE_STEPS,
  useDriverHarness,
} from "./utils";

useDriverHarness();

const liveRegion = () => document.querySelector(".driver-live-region");
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

describe("updatePopover", () => {
  it("changes the title and description in place", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    const wrapper = popoverEl();

    d.updatePopover({ title: "Try again", description: "Right-click instead." });

    expect(popoverEl()).toBe(wrapper);
    expect(popoverTitle()).toBe("Try again");
    expect(popoverDescription()).toBe("Right-click instead.");
  });

  it("merges successive patches", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ title: "New title" });
    d.updatePopover({ description: "New description" });

    expect(popoverTitle()).toBe("New title");
    expect(popoverDescription()).toBe("New description");
  });

  it("restores the step's original popover when called without a patch", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ title: "Changed", showButtons: ["close"] });
    d.updatePopover();

    expect(popoverTitle()).toBe("Step 1");
    expect(popoverDescription()).toBe("First");
    expect(navButton("next")?.style.display).toBe("block");
  });

  it("shows a title or description that the step did not have", async () => {
    const d = createDriver({ animate: false, steps: [{ element: "#intro", popover: { title: "Only title" } }] });
    d.drive();
    await nextFrame();

    d.updatePopover({ description: "Added later" });

    const description = document.querySelector<HTMLElement>(".driver-popover-description");
    expect(description?.style.display).toBe("block");
    expect(popoverDescription()).toBe("Added later");
  });

  it("toggles buttons", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();

    d.updatePopover({ showButtons: ["close"] });
    expect(navButton("next")?.style.display).toBe("none");
    expect(navButton("close")?.style.display).toBe("block");

    d.updatePopover({ showButtons: ["next", "previous", "close"], disableButtons: ["next"] });
    expect(navButton("next")?.style.display).toBe("block");
    expect(navButton("next")?.disabled).toBe(true);

    d.updatePopover({ disableButtons: [] });
    expect(navButton("next")?.disabled).toBe(false);
    expect(navButton("next")?.classList.contains("driver-popover-btn-disabled")).toBe(false);
  });

  it("swaps the custom popover class", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ popoverClass: "is-wrong" });
    expect(popoverEl()?.classList.contains("is-wrong")).toBe(true);
    expect(popoverEl()?.classList.contains("driver-popover")).toBe(true);

    d.updatePopover({ popoverClass: "" });
    expect(popoverEl()?.classList.contains("is-wrong")).toBe(false);
  });

  it("does not re-run onPopoverRender", async () => {
    const onPopoverRender = vi.fn();
    const d = createDriver({ animate: false, onPopoverRender, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ description: "Changed" });
    expect(onPopoverRender).toHaveBeenCalledTimes(1);
  });

  it("does not take focus", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    const button = document.querySelector<HTMLButtonElement>("#card-1")!;
    button.focus();
    d.updatePopover({ description: "Changed" });

    expect(document.activeElement).toBe(button);
  });

  it("moves focus to the popover when the focused button gets hidden", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();

    navButton("next")?.focus();
    d.updatePopover({ showButtons: [] });

    expect(document.activeElement).toBe(popoverEl());
  });

  it("is temporary: revisiting the step shows the original", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ title: "Changed" });
    d.moveNext();
    await nextFrame();
    expect(popoverTitle()).toBe("Step 2");

    d.movePrevious();
    await nextFrame();
    expect(popoverTitle()).toBe("Step 1");
    expect(SAMPLE_STEPS[0].popover?.title).toBe("Step 1");
  });

  it("survives a refresh", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ title: "Changed" });
    d.refresh();
    await nextFrame();
    window.dispatchEvent(new Event("resize"));
    await nextFrame();

    expect(popoverTitle()).toBe("Changed");
  });

  it("applies to the incoming popover during a transition", async () => {
    const d = createDriver({ animate: true, duration: 40, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    await wait(60);

    d.moveNext();
    d.updatePopover({ title: "Patched early" });
    await wait(80);

    expect(popoverTitle()).toBe("Patched early");
  });

  it("does nothing without an active tour", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    expect(() => d.updatePopover({ title: "Nope" })).not.toThrow();
    expect(popoverEl()).toBeNull();
  });

  it("is reachable from hooks through opts.driver", async () => {
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onHighlighted: (_el, _step, opts) => opts.driver.updatePopover({ description: "From a hook" }),
    });
    d.drive();
    await nextFrame();

    expect(popoverDescription()).toBe("From a hook");
  });

  describe("announcements", () => {
    it("announces changed text through a polite live region", async () => {
      const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
      d.drive();
      await nextFrame();

      expect(liveRegion()?.getAttribute("aria-live")).toBe("polite");
      expect(liveRegion()?.textContent).toBe("");

      d.updatePopover({ description: "Right-click instead." });
      expect(liveRegion()?.textContent).toBe("Right-click instead.");
    });

    it("does not re-announce unchanged text", async () => {
      const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
      d.drive();
      await nextFrame();

      d.updatePopover({ description: "Same" });
      liveRegion()!.textContent = "";
      d.updatePopover({ description: "Same" });

      expect(liveRegion()?.textContent).toBe("");
    });

    it("removes the live region on destroy", async () => {
      const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
      d.drive();
      await nextFrame();
      d.destroy();

      expect(liveRegion()).toBeNull();
    });
  });

  it("keeps focus in the popover when the focused content is replaced", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#intro", popover: { title: "T", description: `<input id="answer">` } }],
    });
    d.drive();
    await nextFrame();

    document.querySelector<HTMLInputElement>("#answer")?.focus();
    d.updatePopover({ description: "Wrong answer, try again." });

    expect(document.activeElement).toBe(document.querySelector(".driver-popover"));
  });

  it("announces the same feedback again on a later step", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.updatePopover({ description: "Right-click instead." });

    d.moveNext();
    await nextFrame();
    const region = document.querySelector(".driver-live-region")!;
    region.textContent = "";
    d.updatePopover({ description: "Right-click instead." });

    expect(region.textContent).toBe("Right-click instead.");
  });
});

describe("updatePopover precision", () => {
  it("leaves untouched content and its handlers alone", async () => {
    const onClick = vi.fn();
    const d = createDriver({
      animate: false,
      steps: [
        {
          element: "#intro",
          popover: { title: "Title", description: `<input id="note"><button id="extra">Extra</button>` },
        },
      ],
      onPopoverRender: () => document.querySelector("#extra")?.addEventListener("click", onClick),
    });
    d.drive();
    await nextFrame();

    const input = document.querySelector<HTMLInputElement>("#note")!;
    input.value = "typed";
    d.updatePopover({ title: "Updated title" });

    expect(document.querySelector("#note")).toBe(input);
    expect(input.value).toBe("typed");
    document.querySelector<HTMLButtonElement>("#extra")?.click();
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("lets explicit false and empty values win over the config", async () => {
    const d = createDriver({ animate: false, showProgress: true, popoverClass: "global-theme", steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ showProgress: false, popoverClass: "" });

    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")?.style.display).toBe("none");
    expect(popoverEl()?.classList.contains("global-theme")).toBe(false);
  });

  it("fills progress placeholders in a patched progressText", async () => {
    const d = createDriver({ animate: false, showProgress: true, steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();

    d.updatePopover({ progressText: "Step {{current}} / {{total}}" });

    expect(document.querySelector(".driver-popover-progress-text")?.textContent).toBe("Step 2 / 3");
  });
});

describe("updatePopover from hooks", () => {
  it("applies updatePopover called from onPopoverRender", async () => {
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onPopoverRender: (_popover, opts) => opts.driver.updatePopover({ title: "From render" }),
    });
    d.drive();
    await nextFrame();

    expect(popoverTitle()).toBe("From render");
  });

  it("applies updatePopover from an initial-wait timeout hook", async () => {
    createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        opts.driver.updatePopover({ description: "Load failed; retry" });
        return false;
      },
      steps: [{ element: "#never", waitForElement: 30, popover: { title: "First", description: "Waiting" } }],
    }).drive();
    await wait(70);

    expect(document.querySelector(".driver-popover-description")?.textContent).toBe("Load failed; retry");
  });
});

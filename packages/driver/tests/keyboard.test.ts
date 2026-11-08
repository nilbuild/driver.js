import { describe, expect, it, vi } from "vitest";
import {
  append,
  createDriver,
  keyEvent,
  nextFrame,
  popoverTitle,
  pressKey,
  SAMPLE_STEPS,
  useDriverHarness,
} from "./utils";

useDriverHarness();

describe("keyboard control", () => {
  it("closes the tour when Escape is pressed", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(false);
  });

  it("ignores Escape when allowClose is false", () => {
    const d = createDriver({ animate: false, allowClose: false, steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(true);
  });

  it("still closes with Escape when overlayClickBehavior is 'none'", () => {
    const d = createDriver({ animate: false, overlayClickBehavior: "none", steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(false);
  });

  it("navigates with the arrow keys", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    // Arrow handlers no-op mid-transition, so let the highlight settle first.
    await nextFrame();

    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");

    pressKey("ArrowLeft");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);
  });

  it("does not close the tour when ArrowLeft is pressed on the first step", async () => {
    const d = createDriver({ animate: false, allowClose: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowLeft");
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("runs onDoneClick when ArrowRight is pressed on the final step", async () => {
    const onDoneClick = vi.fn();
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDoneClick, onNextClick });
    d.drive(SAMPLE_STEPS.length - 1);
    await nextFrame();

    pressKey("ArrowRight");

    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(onNextClick).not.toHaveBeenCalled();
    expect(d.isActive()).toBe(true);
  });

  it("ignores keys when allowKeyboardControl is false", () => {
    const d = createDriver({ animate: false, allowKeyboardControl: false, steps: SAMPLE_STEPS });
    d.drive();

    pressKey("ArrowRight");
    expect(d.getActiveIndex()).toBe(0);

    pressKey("Escape");
    expect(d.isActive()).toBe(true);
  });

  it("runs onPrevClick instead of moving back when ArrowLeft is pressed", async () => {
    const onPrevClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onPrevClick });
    d.drive(1);
    await nextFrame();

    pressKey("ArrowLeft");

    expect(onPrevClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("runs onNextClick instead of advancing when ArrowRight is pressed", async () => {
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onNextClick });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");

    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores arrow keys while a highlight transition is in flight", () => {
    const d = createDriver({ animate: true, steps: SAMPLE_STEPS });
    d.drive();
    // No frame awaited: the transition callback is still set, so arrows no-op.
    pressKey("ArrowRight");

    expect(d.getActiveIndex()).toBe(0);
  });
});

describe("keyboard control follows the buttons", () => {
  it("ignores ArrowRight when the next button is hidden", async () => {
    const d = createDriver({ animate: false, showButtons: ["previous", "close"], steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores ArrowRight when the next button is disabled globally", async () => {
    const d = createDriver({ animate: false, disableButtons: ["next"], steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores ArrowLeft when the previous button is hidden", async () => {
    const d = createDriver({ animate: false, showButtons: ["next", "close"], steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();

    pressKey("ArrowLeft");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("ignores ArrowRight when the next button is disabled", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1", disableButtons: ["next"] } },
        { element: "#card-1", popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);
  });

  it("ignores Escape when the close button is disabled", () => {
    const d = createDriver({ animate: false, disableButtons: ["close"], steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(true);
  });

  it("still closes with Escape when the close button is only hidden", () => {
    const d = createDriver({ animate: false, showButtons: ["next", "previous"], steps: SAMPLE_STEPS });
    d.drive();
    pressKey("Escape");

    expect(d.isActive()).toBe(false);
  });

  it("closes a highlight with Escape", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });
    pressKey("Escape");

    expect(d.isActive()).toBe(false);
  });

  it("does not advance with ArrowRight after Next was hidden", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ showButtons: ["close"] });
    keyEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }, document.body);

    expect(d.getActiveIndex()).toBe(0);
  });
});

describe("widget key ownership across keydown and keyup", () => {
  it("does not close the tour when a widget's Escape moves focus outside", async () => {
    const trigger = append("trigger");
    const menu = append("menu", "div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("button");
    menu.appendChild(item);
    item.addEventListener("keydown", e => {
      if (e.key === "Escape") {
        trigger.focus();
      }
    });

    const d = createDriver({ animate: false, steps: [{ element: "#menu", popover: { title: "Menu" } }] });
    d.drive();
    await nextFrame();

    item.focus();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, item);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, trigger);

    expect(d.isActive()).toBe(true);
  });

  it("keeps Escape with the widget when a capture handler moves focus outside", async () => {
    const trigger = append("trigger");
    const menu = append("menu", "div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("button");
    menu.appendChild(item);

    const d = createDriver({
      animate: false,
      steps: [{ element: "#menu", popover: { title: "Menu" } }],
      onInteraction: (_el, _step, opts) => {
        if ((opts.event as KeyboardEvent).key === "Escape") {
          trigger.focus();
        }
      },
    });
    d.drive();
    await nextFrame();

    item.focus();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, item);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, trigger);

    expect(d.isActive()).toBe(true);
  });

  it("does not leave a rejected widget key owning the next Escape", async () => {
    const menu = append("menu", "div");
    menu.setAttribute("role", "menu");
    const item = document.createElement("button");
    menu.appendChild(item);
    const d = createDriver({
      animate: false,
      steps: [{ element: "#menu", popover: { title: "Menu" } }],
      onInteraction: (_el, _step, opts) => ((opts.event as KeyboardEvent).key === "Escape" ? false : undefined),
    });
    d.drive();
    await nextFrame();

    item.focus();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, item);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, item);
    expect(d.isActive()).toBe(true);

    item.blur();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, document.body);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, document.body);
    expect(d.isActive()).toBe(false);
  });
});

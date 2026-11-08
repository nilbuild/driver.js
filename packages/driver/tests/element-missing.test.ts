import { describe, expect, it, vi } from "vitest";
import {
  createDriver,
  navButton,
  nextFrame,
  popoverEl,
  popoverTitle,
  popoverDescription,
  useDriverHarness,
} from "./utils";

useDriverHarness();

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const isWaiting = () => !!popoverEl()?.classList.contains("driver-popover-waiting");

function append(id: string, className = ""): HTMLElement {
  const element = document.createElement("button");
  element.id = id;
  element.className = className;
  document.body.appendChild(element);
  return element;
}

function fire(target: Element | null, type: string) {
  target?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true }));
}

describe("waiting state", () => {
  it("disables Next and Previous but keeps close usable while waiting", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#card-1", popover: { title: "Two" } },
        { element: "#late", waitForElement: 500, popover: { title: "Three" } },
      ],
    });
    d.drive(1);
    await nextFrame();
    d.moveNext();

    expect(isWaiting()).toBe(true);
    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("prev")?.disabled).toBe(true);
    expect(navButton("close")?.disabled).toBe(false);

    navButton("close")?.click();
    expect(d.isActive()).toBe(false);
  });

  it("closing during the initial wait ends the tour for good", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#late", waitForElement: 500, popover: { title: "First" } }],
    });
    d.drive();
    expect(isWaiting()).toBe(true);

    navButton("close")?.click();
    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();

    append("late");
    await tick();
    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();
  });
});

describe("onElementMissing: timeout", () => {
  it("runs instead of the fallback, with the waited-for step", async () => {
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#never", waitForElement: 30, popover: { title: "Two" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    await tick(60);

    expect(onElementMissing).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onElementMissing.mock.calls[0];
    expect(element).toBeUndefined();
    expect(step.popover.title).toBe("Two");
    expect(opts.cause).toBe("timeout");
    expect(opts.index).toBe(0);

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("One");
    expect(isWaiting()).toBe(false);
  });

  it("prefers the waited-for step's hook", async () => {
    const configHook = vi.fn();
    const stepHook = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing: configHook,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#never", waitForElement: 30, onElementMissing: stepHook },
      ],
    });
    d.drive();
    d.moveNext();
    await tick(60);

    expect(stepHook).toHaveBeenCalledTimes(1);
    expect(configHook).not.toHaveBeenCalled();
  });

  it("supports timeout, hint, retry, advance", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        if (opts.cause === "timeout") {
          opts.driver.updatePopover({ description: "Try again" });
        }
      },
      steps: [
        { element: "#intro", advanceOn: "contextmenu", popover: { title: "One", description: "Right-click" } },
        { element: "#late", waitForElement: 30, popover: { title: "Two" } },
      ],
    });
    d.drive();
    await nextFrame();

    fire(document.querySelector("#intro"), "contextmenu");
    await tick(60);
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverDescription()).toBe("Try again");

    append("late");
    fire(document.querySelector("#intro"), "contextmenu");
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Two");
  });

  it("reports the waited-for index on the initial wait", async () => {
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#never", waitForElement: 30, popover: { title: "Two" } },
      ],
    });
    d.drive(1);
    await tick(60);

    expect(onElementMissing.mock.calls[0][2].index).toBe(1);
    expect(isWaiting()).toBe(false);
    expect(d.isActive()).toBe(true);
  });
});

describe("onElementMissing: removed", () => {
  const steps = () => [
    { element: "#target", popover: { title: "Target" } },
    { element: "#intro", popover: { title: "Intro" } },
  ];

  it("fires when the highlighted element leaves the DOM", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    createDriver({ animate: false, onElementMissing, steps: steps() }).drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onElementMissing.mock.calls[0];
    expect(element).toBe(target);
    expect(step.popover.title).toBe("Target");
    expect(opts.cause).toBe("removed");
  });

  it("fires once per removal", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    createDriver({ animate: false, onElementMissing, steps: steps() }).drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    document.body.appendChild(document.createElement("span"));
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).toHaveBeenCalledTimes(1);
  });

  it("does nothing without a hook", async () => {
    const target = append("target");
    const d = createDriver({ animate: false, steps: steps() });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(0);
  });

  it("follows a re-rendered element instead of firing", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    const d = createDriver({ animate: false, onElementMissing, steps: steps() });
    d.drive();
    await nextFrame();

    target.remove();
    const replacement = append("target");
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).not.toHaveBeenCalled();
    expect(d.getActiveElement()).toBe(replacement);
    expect(replacement.classList.contains("driver-active-element")).toBe(true);
  });

  it("waits out the grace period before firing", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    createDriver({
      animate: false,
      onElementMissing,
      steps: [{ element: "#target", waitForElement: 60, popover: { title: "Target" } }],
    }).drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    expect(onElementMissing).not.toHaveBeenCalled();
    expect(isWaiting()).toBe(true);

    await tick(90);
    expect(onElementMissing).toHaveBeenCalledTimes(1);
  });

  it("continues silently when the element returns within the grace period", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [{ element: "#target", waitForElement: 200, popover: { title: "Target" } }],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    const back = append("target");
    await nextFrame();
    await nextFrame();

    expect(isWaiting()).toBe(false);
    expect(d.getActiveElement()).toBe(back);

    await tick(250);
    expect(onElementMissing).not.toHaveBeenCalled();
  });

  it("does not fire when the correct action removes the element", async () => {
    const item = append("item");
    item.addEventListener("click", () => item.remove());
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        { element: "#item", advanceOn: "click" },
        { element: "#later", waitForElement: 100 },
      ],
    });
    d.drive();
    await nextFrame();

    fire(item, "click");
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).not.toHaveBeenCalled();
  });

  it("does not fire while a deferred completion is pending", async () => {
    const item = append("item");
    item.addEventListener("click", e => {
      e.stopPropagation();
      item.remove();
    });
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [{ element: "#item", advanceOn: "click" }, { element: "#intro" }],
    });
    d.drive();
    await nextFrame();

    fire(item, "click");
    await tick(30);

    expect(onElementMissing).not.toHaveBeenCalled();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("lets the recipe send the trainee back with a hint", async () => {
    const menuItem = append("rename");
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        if (opts.cause === "removed") {
          opts.driver.movePrevious();
          opts.driver.updatePopover({ description: "The menu closed. Open it again." });
        }
      },
      steps: [
        { element: "#intro", popover: { title: "Open", description: "Right-click" } },
        { element: "#rename", popover: { title: "Rename", description: "Choose Rename" } },
      ],
    });
    d.drive(1);
    await nextFrame();

    menuItem.remove();
    await nextFrame();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Open");
    expect(popoverDescription()).toBe("The menu closed. Open it again.");
  });
});

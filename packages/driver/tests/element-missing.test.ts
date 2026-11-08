import { describe, expect, it, vi } from "vitest";
import {
  createDriver,
  navButton,
  nextFrame,
  popoverEl,
  append,
  keyEvent,
  popoverTitle,
  popoverDescription,
  SAMPLE_STEPS,
  tick,
  useDriverHarness,
} from "./utils";

useDriverHarness();

const isWaiting = () => !!popoverEl()?.classList.contains("driver-popover-waiting");

function fire(target: Element | null, type: string) {
  target?.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, composed: true }));
}

describe("waiting state", () => {
  const waitingTour = () =>
    createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#card-1", popover: { title: "Two" } },
        { element: "#late", waitForElement: 500, popover: { title: "Three" } },
      ],
    });

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

  it("keeps navigation disabled when the text is updated while waiting", async () => {
    const d = waitingTour();
    d.drive(1);
    await nextFrame();
    d.moveNext();

    d.updatePopover({ description: "Please wait" });

    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("prev")?.disabled).toBe(true);
  });

  it("ignores arrow keys while waiting", async () => {
    const d = waitingTour();
    d.drive(1);
    await nextFrame();
    d.moveNext();

    keyEvent("keyup", { key: "ArrowLeft", code: "ArrowLeft" }, document.body);
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Two");
  });

  it("renders a delayed popover in the waiting state when a wait is pending", async () => {
    const d = createDriver({
      animate: true,
      duration: 200,
      steps: [
        SAMPLE_STEPS[0],
        { element: "#card-1", popover: { title: "Two" }, advanceOn: "click" },
        { element: "#late", waitForElement: 1000, popover: { title: "Late" } },
      ],
    });
    d.drive();
    await tick(250);
    d.moveNext();
    fire(document.querySelector("#card-1"), "click");
    await tick(300);

    expect(popoverTitle()).toBe("Two");
    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("prev")?.disabled).toBe(true);
  });
});

describe("onElementMissing: timeout", () => {
  it("runs before the fallback, with the waited-for step and its index", async () => {
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
    expect(opts.index).toBe(1);

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Two");
    expect(isWaiting()).toBe(false);
  });

  it("keeps the current step when the hook returns false", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: () => false,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#never", waitForElement: 30, popover: { title: "Two" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    await tick(60);

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("One");
    expect(isWaiting()).toBe(false);
  });

  it("skips the fallback when the hook navigates", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => opts.driver.moveTo(2),
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#never", waitForElement: 30, popover: { title: "Two" } },
        { element: "#card-1", popover: { title: "Three" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    await tick(60);

    expect(d.getActiveIndex()).toBe(2);
    expect(popoverTitle()).toBe("Three");
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
          return false;
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

  it("moves on to the next missing step after an initial timeout", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        opts.driver.updatePopover({ description: "Unavailable; click Next to skip." });
        return false;
      },
      steps: [
        { element: "#missing-1", waitForElement: 30, popover: { title: "One" } },
        { element: "#missing-2", waitForElement: 30, popover: { title: "Two" } },
        { element: "#intro", popover: { title: "Three" } },
      ],
    });
    d.drive();
    await tick(70);

    navButton("next")?.click();
    expect(popoverTitle()).toBe("Two");
    expect(d.getActiveIndex()).toBe(1);
    expect(navButton("next")?.disabled).toBe(true);

    await tick(70);
    navButton("next")?.click();
    await nextFrame();
    expect(popoverTitle()).toBe("Three");
  });

  it("honours a close-button patch on Escape during an initial wait", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        opts.driver.updatePopover({ disableButtons: ["close"] });
        return false;
      },
      steps: [{ element: "#missing", waitForElement: 30, popover: { title: "One" } }],
    });
    d.drive();
    await tick(70);

    keyEvent("keyup", { key: "Escape", code: "Escape" }, document.body);
    expect(d.isActive()).toBe(true);
  });

  it("runs onDestroyed when closing during an initial wait", async () => {
    const onDestroyed = vi.fn();
    createDriver({
      animate: false,
      onDestroyed,
      steps: [{ element: "#missing", waitForElement: 500, popover: { title: "First" } }],
    }).drive();

    navButton("close")?.click();

    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onDestroyed.mock.calls[0][0]).toBeUndefined();
    expect(onDestroyed.mock.calls[0][1].popover.title).toBe("First");
  });

  it("lets ArrowRight move on after an initial timeout", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => {
        opts.driver.updatePopover({ description: "Click Next to skip." });
        return false;
      },
      steps: [
        { element: "#missing", waitForElement: 30, popover: { title: "One" } },
        { element: "#intro", popover: { title: "Two" } },
      ],
    });
    d.drive();
    await tick(70);

    keyEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }, document.body);
    expect(popoverTitle()).toBe("Two");
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

  it("does not report removed while a completion is navigating", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        {
          element: "#target",
          waitForElement: 40,
        },
        { element: "#later", waitForElement: 500 },
      ],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    d.moveNext();
    await tick(80);

    expect(onElementMissing).not.toHaveBeenCalled();
  });

  it("keeps the waiting state when the target returns during a pending navigation", async () => {
    const target = append("target");
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [
        {
          element: "#target",
          waitForElement: 200,
          popover: { title: "Target" },
        },
        { element: "#later", waitForElement: 1000, popover: { title: "Later" } },
      ],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    d.moveNext();
    document.body.appendChild(target);
    await tick(260);

    expect(navButton("next")?.disabled).toBe(true);
    expect(document.querySelector(".driver-popover")?.classList.contains("driver-popover-waiting")).toBe(true);
  });

  it("reports again after the same node is reinserted and removed", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    createDriver({
      animate: false,
      onElementMissing,
      steps: [{ element: "#target", popover: { title: "T" } }],
    }).drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    expect(onElementMissing).toHaveBeenCalledTimes(1);

    document.body.appendChild(target);
    await nextFrame();
    await nextFrame();
    target.remove();
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).toHaveBeenCalledTimes(2);
  });

  it("clears the waiting state as soon as the same node comes back", async () => {
    const target = append("target");
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [SAMPLE_STEPS[0], { element: "#target", waitForElement: 500, popover: { title: "T" } }, SAMPLE_STEPS[1]],
    });
    d.drive(1);
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    expect(navButton("next")?.disabled).toBe(true);

    document.body.appendChild(target);
    await nextFrame();
    await nextFrame();

    expect(navButton("next")?.disabled).toBe(false);
    expect(document.querySelector(".driver-popover")?.classList.contains("driver-popover-waiting")).toBe(false);
  });

  it("moves the spotlight to where a reinserted node now sits", async () => {
    const target = append("target");
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [{ element: "#target", waitForElement: 200, popover: { title: "T" } }],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    target.getBoundingClientRect = () =>
      ({
        x: 120,
        y: 240,
        width: 40,
        height: 20,
        top: 240,
        left: 120,
        right: 160,
        bottom: 260,
        toJSON: () => ({}),
      }) as DOMRect;
    document.body.appendChild(target);
    await nextFrame();
    await nextFrame();

    expect(d.getState("__activeStagePosition")).toMatchObject({ x: 120, y: 240, width: 40, height: 20 });
  });

  it("does not report removed while Next is waiting for the destination", async () => {
    const page = append("page", "div");
    const onElementMissing = vi.fn();
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        {
          element: "#page",
          popover: {
            title: "Go",
            onNextClick: () => {
              page.remove();
              d.moveNext();
            },
          },
        },
        { element: "#destination", waitForElement: 500, popover: { title: "There" } },
      ],
    });
    d.drive();
    await nextFrame();

    navButton("next")?.click();
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).not.toHaveBeenCalled();
  });
});

describe("replaced elements", () => {
  it("keeps the replacement after an animated transition finishes", async () => {
    append("target");
    const d = createDriver({
      animate: true,
      duration: 60,
      onElementMissing: vi.fn(),
      steps: [SAMPLE_STEPS[0], { element: "#target", popover: { title: "T" } }],
    });
    d.drive();
    await tick(100);
    d.moveNext();
    await nextFrame();

    document.querySelector("#target")?.remove();
    const replacement = append("target");
    await tick(150);

    expect(d.getActiveElement()).toBe(replacement);
    expect(d.getState("__activeElement")).toBe(replacement);
  });

  it("cleans driver state off the replaced element", async () => {
    const original = append("target");
    const d = createDriver({ animate: false, onElementMissing: vi.fn(), steps: [{ element: "#target" }] });
    d.drive();
    await nextFrame();

    original.remove();
    append("target");
    await nextFrame();
    await nextFrame();

    expect(original.classList.contains("driver-active-element")).toBe(false);
  });

  it("renders a delayed popover against the rebound element", async () => {
    append("target");
    const onNextClick = vi.fn();
    const d = createDriver({
      animate: true,
      duration: 200,
      onElementMissing: vi.fn(),
      steps: [SAMPLE_STEPS[0], { element: "#target", popover: { title: "T", onNextClick } }],
    });
    d.drive();
    await tick(250);
    d.moveNext();
    await nextFrame();

    document.querySelector("#target")?.remove();
    const replacement = append("target");
    await tick(300);

    navButton("next")?.click();
    expect(onNextClick.mock.calls[0][0]).toBe(replacement);
  });

  it("passes the rebound element to popover button hooks", async () => {
    const original = append("target");
    const onNextClick = vi.fn();
    createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [{ element: "#target", popover: { title: "T", onNextClick } }],
    }).drive();
    await nextFrame();

    original.remove();
    const replacement = append("target");
    await nextFrame();
    await nextFrame();

    navButton("next")?.click();
    expect(onNextClick.mock.calls[0][0]).toBe(replacement);
  });

  it("moves the popover into a replacement dialog", async () => {
    const makeDialog = () => {
      const dialog = document.createElement("dialog");
      dialog.innerHTML = `<button id="in-dialog">Go</button>`;
      document.body.appendChild(dialog);
      dialog.setAttribute("open", "");
      return dialog;
    };
    const first = makeDialog();
    createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [{ element: "#in-dialog", popover: { title: "In dialog" } }],
    }).drive();
    await nextFrame();
    const popover = document.querySelector(".driver-popover")!;
    expect(first.contains(popover)).toBe(true);

    first.remove();
    const second = makeDialog();
    await nextFrame();
    await nextFrame();

    expect(second.contains(popover)).toBe(true);
  });
});

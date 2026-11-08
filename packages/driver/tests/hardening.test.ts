import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

function key(type: "keydown" | "keyup", init: KeyboardEventInit, target: Element = document.activeElement || document.body) {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function append(id: string, tag = "button"): HTMLElement {
  const element = document.createElement(tag);
  element.id = id;
  document.body.appendChild(element);
  return element;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("keyboard ownership across keydown and keyup", () => {
  it("does not close the tour when a widget's Escape moves focus outside", async () => {
    const trigger = append("trigger");
    const menu = append("menu", "div");
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
    key("keydown", { key: "Escape", code: "Escape" }, item);
    key("keyup", { key: "Escape", code: "Escape" }, trigger);

    expect(d.isActive()).toBe(true);
  });
});

describe("focus trap", () => {
  it("does not loop when the highlighted element sits inside an allowed element", async () => {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(10);
    const menu = append("menu", "div");
    const [a, b, c] = ["a", "b", "c"].map(id => {
      const button = document.createElement("button");
      button.id = id;
      menu.appendChild(button);
      return button;
    });

    const d = createDriver({
      animate: false,
      steps: [{ element: "#b", allowedElements: "#menu", popover: { title: "B", showButtons: [] } }],
    });
    d.drive();
    await nextFrame();

    b.focus();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));

    expect(document.activeElement).toBe(c);
    expect(a).toBeTruthy();
  });
});

describe("allowed element tracking", () => {
  it("settles instead of re-running every frame", async () => {
    const menu = append("menu", "div");
    const resolver = vi.fn(() => [menu]);
    createDriver({ animate: false, steps: [{ ...SAMPLE_STEPS[0], allowedElements: resolver }] }).drive();
    await nextFrame();

    document.body.appendChild(document.createElement("span"));
    for (let i = 0; i < 5; i++) {
      await nextFrame();
    }
    const settledCount = resolver.mock.calls.length;

    for (let i = 0; i < 5; i++) {
      await nextFrame();
    }
    expect(resolver.mock.calls.length).toBe(settledCount);
  });
});

describe("setSteps", () => {
  it("does not install a second gate or live region", async () => {
    const onInteraction = vi.fn();
    const d = createDriver({ animate: false, onInteraction, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.setSteps(SAMPLE_STEPS);
    d.drive();
    await nextFrame();

    document.querySelector("#intro")?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));
    expect(onInteraction).toHaveBeenCalledTimes(1);
    expect(document.querySelectorAll(".driver-live-region")).toHaveLength(1);

    d.destroy();
    expect(document.querySelectorAll(".driver-live-region")).toHaveLength(0);
  });
});

describe("removal during a pending completion", () => {
  it("does not report removed while a completion is navigating", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    let next: (() => void) | undefined;
    const d = createDriver({
      animate: false,
      onElementMissing,
      steps: [
        {
          element: "#target",
          waitForElement: 40,
          advanceOn: (_el, _step, opts) => {
            next = opts.next;
          },
        },
        { element: "#later", waitForElement: 500 },
      ],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    next?.();
    await tick(80);

    expect(onElementMissing).not.toHaveBeenCalled();
  });
});

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

    key("keyup", { key: "ArrowLeft", code: "ArrowLeft" }, document.body);
    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Two");
  });
});

describe("keyboard and patched buttons", () => {
  it("does not advance with ArrowRight after Next was hidden", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ showButtons: ["close"] });
    key("keyup", { key: "ArrowRight", code: "ArrowRight" }, document.body);

    expect(d.getActiveIndex()).toBe(0);
  });
});

describe("rebinding", () => {
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
});

describe("highlight() during a pending wait", () => {
  it("cancels the wait so it cannot take over later", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#late", waitForElement: 500, popover: { title: "Late" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    d.highlight({ element: "#card-1", popover: { title: "Highlighted" } });
    append("late", "div");
    await tick(30);

    expect(popoverTitle()).toBe("Highlighted");
  });
});

describe("hooks during render", () => {
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
});

describe("second review", () => {
  it("keeps Escape with the widget when a capture handler moves focus outside", async () => {
    const trigger = append("trigger");
    const menu = append("menu", "div");
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
    key("keydown", { key: "Escape", code: "Escape" }, item);
    key("keyup", { key: "Escape", code: "Escape" }, trigger);

    expect(d.isActive()).toBe(true);
  });

  it("keeps the waiting state when the target returns during a pending navigation", async () => {
    const target = append("target");
    let next: (() => void) | undefined;
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [
        {
          element: "#target",
          waitForElement: 200,
          popover: { title: "Target" },
          advanceOn: (_el, _step, opts) => {
            next = opts.next;
          },
        },
        { element: "#later", waitForElement: 1000, popover: { title: "Later" } },
      ],
    });
    d.drive();
    await nextFrame();

    target.remove();
    await nextFrame();
    await nextFrame();
    next?.();
    document.body.appendChild(target);
    await tick(260);

    expect(navButton("next")?.disabled).toBe(true);
    expect(document.querySelector(".driver-popover")?.classList.contains("driver-popover-waiting")).toBe(true);
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
});

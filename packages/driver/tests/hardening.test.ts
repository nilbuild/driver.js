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

describe("third review", () => {
  it("does not leave a rejected widget key owning the next Escape", async () => {
    const menu = append("menu", "div");
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
    key("keydown", { key: "Escape", code: "Escape" }, item);
    key("keyup", { key: "Escape", code: "Escape" }, item);
    expect(d.isActive()).toBe(true);

    item.blur();
    key("keydown", { key: "Escape", code: "Escape" }, document.body);
    key("keyup", { key: "Escape", code: "Escape" }, document.body);
    expect(d.isActive()).toBe(false);
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

  it("renders a delayed popover in the waiting state when a wait is pending", async () => {
    let next: (() => void) | undefined;
    const d = createDriver({
      animate: true,
      duration: 200,
      steps: [
        SAMPLE_STEPS[0],
        {
          element: "#card-1",
          popover: { title: "Two" },
          advanceOn: (_el, _step, opts) => {
            next = opts.next;
          },
        },
        { element: "#late", waitForElement: 1000, popover: { title: "Late" } },
      ],
    });
    d.drive();
    await tick(250);
    d.moveNext();
    next?.();
    await tick(300);

    expect(popoverTitle()).toBe("Two");
    expect(navButton("next")?.disabled).toBe(true);
    expect(navButton("prev")?.disabled).toBe(true);
  });
});

describe("fourth review", () => {
  it("reports again after the same node is reinserted and removed", async () => {
    const target = append("target");
    const onElementMissing = vi.fn();
    createDriver({ animate: false, onElementMissing, steps: [{ element: "#target", popover: { title: "T" } }] }).drive();
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
});

describe("fifth review", () => {
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
      ({ x: 120, y: 240, width: 40, height: 20, top: 240, left: 120, right: 160, bottom: 260, toJSON: () => ({}) }) as DOMRect;
    document.body.appendChild(target);
    await nextFrame();
    await nextFrame();

    expect(d.getState("__activeStagePosition")).toMatchObject({ x: 120, y: 240, width: 40, height: 20 });
  });
});

describe("seventh review", () => {
  it("re-binds a function advanceOn to a re-rendered element", async () => {
    const input = append("field", "input");
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [
        {
          element: "#field",
          advanceOn: (el, _step, opts) => {
            el?.addEventListener("keydown", e => (e as KeyboardEvent).key === "Enter" && opts.next(), { signal: opts.signal });
          },
        },
        SAMPLE_STEPS[1],
      ],
    });
    d.drive();
    await nextFrame();

    input.remove();
    const replacement = append("field", "input");
    await nextFrame();
    await nextFrame();

    key("keydown", { key: "Enter", code: "Enter" }, replacement);
    expect(d.getActiveIndex()).toBe(1);
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

  it("applies updatePopover from an initial-wait timeout hook", async () => {
    createDriver({
      animate: false,
      onElementMissing: (_el, _step, opts) => opts.driver.updatePopover({ description: "Load failed; retry" }),
      steps: [{ element: "#never", waitForElement: 30, popover: { title: "First", description: "Waiting" } }],
    }).drive();
    await tick(70);

    expect(document.querySelector(".driver-popover-description")?.textContent).toBe("Load failed; retry");
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
});

import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
});

const DRIVER_EVENT_TYPES = ["click", "pointerdown", "mousedown", "pointerup", "mouseup"];

type ListenerRecord = {
  type: string;
  listener: EventListenerOrEventListenerObject;
  capture: boolean;
};

function normalizeCapture(options?: boolean | AddEventListenerOptions | EventListenerOptions): boolean {
  if (typeof options === "boolean") {
    return options;
  }

  return !!options?.capture;
}

function trackDocumentListeners() {
  const added: ListenerRecord[] = [];
  const removed: ListenerRecord[] = [];

  const originalAdd = document.addEventListener.bind(document);
  const originalRemove = document.removeEventListener.bind(document);

  vi.spyOn(document, "addEventListener").mockImplementation((type, listener, options) => {
    if (DRIVER_EVENT_TYPES.includes(type)) {
      added.push({
        type,
        listener: listener as EventListenerOrEventListenerObject,
        capture: normalizeCapture(options),
      });
    }

    return originalAdd(type, listener as EventListener, options);
  });

  vi.spyOn(document, "removeEventListener").mockImplementation((type, listener, options) => {
    if (DRIVER_EVENT_TYPES.includes(type)) {
      removed.push({
        type,
        listener: listener as EventListenerOrEventListenerObject,
        capture: normalizeCapture(options),
      });
    }

    return originalRemove(type, listener as EventListener, options);
  });

  function liveCount(): number {
    const outstanding = [...removed];
    let live = 0;

    for (const record of added) {
      const idx = outstanding.findIndex(
        candidate =>
          candidate.type === record.type &&
          candidate.listener === record.listener &&
          candidate.capture === record.capture
      );

      if (idx === -1) {
        live++;
      } else {
        outstanding.splice(idx, 1);
      }
    }

    return live;
  }

  return { liveCount };
}

describe("document listener cleanup", () => {
  it("attaches document click listeners while the tour is active", () => {
    const tracker = trackDocumentListeners();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(tracker.liveCount()).toBeGreaterThan(0);
  });

  it("removes every document click listener once the tour is destroyed", () => {
    const tracker = trackDocumentListeners();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    d.destroy();

    expect(tracker.liveCount()).toBe(0);
  });

  it("does not accumulate document listeners as the tour moves between steps", () => {
    const tracker = trackDocumentListeners();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    const afterFirstStep = tracker.liveCount();

    navButton("next")?.click();
    navButton("next")?.click();

    expect(tracker.liveCount()).toBe(afterFirstStep);
  });

  it("removes the keydown focus-trap listener when destroyed", () => {
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    d.destroy();

    expect(removeSpy.mock.calls.some(([type]) => type === "keydown")).toBe(true);
  });
});

describe("keyboard focus trap", () => {
  function pressTab(opts: { shift?: boolean } = {}): KeyboardEvent {
    const event = new KeyboardEvent("keydown", { key: "Tab", shiftKey: !!opts.shift, cancelable: true });
    window.dispatchEvent(event);
    return event;
  }

  // jsdom doesn't lay elements out, so the focusable buttons read as invisible
  // and focus never actually moves. We assert the trap swallows the Tab (the
  // observable effect) rather than where focus lands.
  it("traps Tab inside the popover while a tour is active", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(pressTab().defaultPrevented).toBe(true);
  });

  it("cycles backwards on Shift+Tab", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(pressTab({ shift: true }).defaultPrevented).toBe(true);
  });

  it("does not trap Tab once the tour is destroyed", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    d.destroy();

    expect(pressTab().defaultPrevented).toBe(false);
  });

  it("ignores non-Tab keys", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    const event = new KeyboardEvent("keydown", { key: "a", cancelable: true });
    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(false);
  });
});

describe("refresh on viewport changes", () => {
  const rect = (over: Partial<DOMRect>): DOMRect =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;
  const overlayD = () => document.querySelector<SVGPathElement>(".driver-overlay path")?.getAttribute("d");

  it("re-tracks the active element when the window resizes", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    // Move the highlighted element, then resize: the overlay cutout should
    // follow it. With default padding 10 / radius 5 the cutout's leading corner
    // sits at (x - 10 + 5, y - 10) = (95, 190).
    document.querySelector<HTMLElement>("#intro")!.getBoundingClientRect = () =>
      rect({ x: 100, y: 200, top: 200, left: 100, width: 50, height: 60 });

    window.dispatchEvent(new Event("resize"));
    await nextFrame();

    expect(overlayD()).toContain("M95,190");
  });

  it("re-tracks the active element on scroll", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    document.querySelector<HTMLElement>("#intro")!.getBoundingClientRect = () =>
      rect({ x: 300, y: 400, top: 400, left: 300, width: 50, height: 60 });

    window.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(overlayD()).toContain("M295,390");
  });
});

describe("overlay pointer suppression", () => {
  it("prevents default on pointer events over the overlay to block page interaction", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    const path = document.querySelector(".driver-overlay path");
    expect(path).not.toBeNull();

    for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup"]) {
      const event = new MouseEvent(type, { bubbles: true, cancelable: true });
      path!.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
    }
  });

  it("still routes overlay clicks to the click handler", async () => {
    const onNextClick = vi.fn();
    const d = createDriver({
      animate: false,
      overlayClickBehavior: "nextStep",
      steps: SAMPLE_STEPS,
      onNextClick,
    });
    d.drive();
    await nextFrame();

    document.querySelector(".driver-overlay path")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(onNextClick).toHaveBeenCalledTimes(1);
  });
});

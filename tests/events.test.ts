import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
});

// The document-level listeners driver.js attaches to intercept clicks.
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

// Wraps document.add/removeEventListener so we can assert that every driver
// listener that gets attached is also detached, i.e. nothing leaks onto the
// document across steps and teardown.
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

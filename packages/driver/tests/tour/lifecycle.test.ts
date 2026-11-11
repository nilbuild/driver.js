import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDriver,
  nextFrame,
  popoverDescription,
  popoverEl,
  popoverTitle,
  SAMPLE_STEPS,
  traced,
  useDriverHarness,
} from "../utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("lifecycle", () => {
  it("reports inert query results before anything is highlighted", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });

    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();
    expect(d.getActiveIndex()).toBeUndefined();
    expect(d.getActiveStep()).toBeUndefined();
    expect(d.getActiveElement()).toBeUndefined();
    expect(d.isFirstStep()).toBe(false);
    expect(d.isLastStep()).toBe(false);
    expect(d.hasNextStep()).toBe(false);
    expect(d.hasPreviousStep()).toBe(false);
  });

  it("activates, renders a popover and marks the element when highlighting", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", description: "The intro paragraph" } });

    expect(d.isActive()).toBe(true);
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(popoverTitle()).toBe("Intro");
    expect(popoverDescription()).toBe("The intro paragraph");
    expect(document.querySelector("#intro")?.classList.contains("driver-active-element")).toBe(true);
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
  });

  it("supports element-less modal popovers via a dummy element", () => {
    const d = createDriver({ animate: false });
    d.highlight({ popover: { title: "Modal", description: "No element" } });

    expect(d.isActive()).toBe(true);
    expect(popoverTitle()).toBe("Modal");
    expect(document.getElementById("driver-dummy-element")).not.toBeNull();
  });

  it("resolves an element returned from a function", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: () => document.querySelector("#intro")!, popover: { title: "Intro" } });

    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
    expect(popoverTitle()).toBe("Intro");
  });

  it("resolves a directly passed element node", () => {
    const d = createDriver({ animate: false });
    const node = document.querySelector("#card-1")!;
    d.highlight({ element: node, popover: { title: "Card" } });

    expect(d.getActiveElement()).toBe(node);
    expect(popoverTitle()).toBe("Card");
  });

  it("mounts the dummy element for a tour step whose selector matches nothing", () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#nonexistent", popover: { title: "Ghost" } }],
    });
    d.drive();

    expect(document.getElementById("driver-dummy-element")).not.toBeNull();
    expect(popoverTitle()).toBe("Ghost");
  });

  it("tears the DOM and state down on destroy", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });
    d.destroy();

    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();
    expect(document.body.classList.contains("driver-active")).toBe(false);
    expect(document.querySelector(".driver-active-element")).toBeNull();
    expect(d.getActiveIndex()).toBeUndefined();
  });
});

describe("drive guards", () => {
  it("logs an error and stays inactive when there are no steps", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = createDriver({ animate: false });
    d.drive();

    expect(error).toHaveBeenCalledWith("No steps to drive through");
    expect(d.isActive()).toBe(false);
    error.mockRestore();
  });

  it("ignores moveNext and movePrevious before the tour starts", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.moveNext();
    d.movePrevious();

    expect(d.isActive()).toBe(false);
    expect(d.getActiveIndex()).toBeUndefined();
  });
});

describe("dummy-element hooks", () => {
  it("passes an undefined element to onDeselected and onDestroyed for a dummy highlight", async () => {
    const onDeselected = vi.fn();
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDeselected, onDestroyed });
    d.highlight({ popover: { title: "Modal" } });
    await nextFrame();

    d.destroy();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onDeselected.mock.calls[0][0]).toBeUndefined();
    expect(onDestroyed.mock.calls[0][0]).toBeUndefined();
  });
});

describe("destroy on an inactive instance", () => {
  function expectTourIntact() {
    expect(popoverTitle()).toBe("Tour");
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(document.querySelector("#card-1")?.classList.contains("driver-active-element")).toBe(true);
  }

  it("leaves another tour alone when destroyed twice", async () => {
    const onDestroyed = vi.fn();
    const hint = createDriver({ animate: false, onDestroyed });
    hint.highlight({ element: "#intro", popover: { title: "Hint" } });
    await nextFrame();
    hint.destroy();

    const tour = createDriver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour" } }] });
    tour.drive();
    hint.destroy();

    expect(tour.isActive()).toBe(true);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expectTourIntact();
  });

  it("leaves another tour alone when it never started", () => {
    const idle = createDriver({ animate: false });
    const tour = createDriver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour" } }] });
    tour.drive();
    idle.destroy();

    expect(tour.isActive()).toBe(true);
    expectTourIntact();
  });

  it("can highlight again after destroy", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "First" } });
    d.destroy();
    d.highlight({ element: "#card-1", popover: { title: "Second" } });

    expect(d.isActive()).toBe(true);
    expect(popoverTitle()).toBe("Second");
    expect(document.querySelector("#card-1")?.classList.contains("driver-active-element")).toBe(true);
  });
});

describe("one active instance at a time", () => {
  it("tears down the active instance when another one starts", async () => {
    const onDestroyed = vi.fn();
    const onDestroyStarted = vi.fn();
    const hint = createDriver({ animate: false, onDestroyed, onDestroyStarted });
    hint.highlight({ element: "#intro", popover: { title: "Hint" } });
    await nextFrame();

    const tour = createDriver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour" } }] });
    tour.drive();

    expect(hint.isActive()).toBe(false);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onDestroyStarted).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".driver-popover")).toHaveLength(1);
    expect(document.querySelector("#intro")?.classList.contains("driver-active-element")).toBe(false);
  });

  it("hands the screen back and forth without leftovers", async () => {
    const a = traced({ onDestroyStarted: undefined });
    const b = traced({
      onDestroyStarted: undefined,
      steps: [{ element: "#card-1", popover: { title: "B1" } }],
    });

    a.d.drive();
    await nextFrame();
    b.d.drive();
    await nextFrame();

    expect(a.d.isActive()).toBe(false);
    expect(b.d.isActive()).toBe(true);
    expect(a.trace.slice(-2)).toEqual(["onDeselected:Step 1:intro (replaced)", "onDestroyed:Step 1:intro (replaced)"]);
    expect(document.querySelectorAll(".driver-popover")).toHaveLength(1);
    expect(document.querySelectorAll(".driver-overlay")).toHaveLength(1);
    expect(popoverTitle()).toBe("B1");

    a.d.drive(1);
    await nextFrame();
    expect(b.d.isActive()).toBe(false);
    expect(b.trace.slice(-1)).toEqual(["onDestroyed:B1:card-1 (replaced)"]);
    expect(document.querySelectorAll(".driver-popover")).toHaveLength(1);
    expect(document.querySelectorAll(".driver-overlay")).toHaveLength(1);
    expect(popoverTitle()).toBe("Step 2");

    b.d.destroy();
    expect(a.d.isActive()).toBe(true);
    a.d.destroy();
    expect(document.querySelector(".driver-overlay")).toBeNull();
    expect(document.querySelector(".driver-live-region")).toBeNull();
    expect(document.body.className).toBe("");
  });
});

describe("setSteps on an active tour", () => {
  it("ends the tour and takes everything off the page, without the destroy hooks", async () => {
    const hooks = { onDestroyStarted: vi.fn(), onDestroyed: vi.fn(), onDeselected: vi.fn() };
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, ...hooks });
    d.drive();
    await nextFrame();

    d.setSteps([{ element: "#card-1", popover: { title: "New" } }]);

    expect(d.isActive()).toBe(false);
    expect(d.getActiveIndex()).toBeUndefined();
    expect(d.getState()).toEqual({});
    expect(document.querySelector(".driver-overlay")).toBeNull();
    expect(popoverEl()).toBeNull();
    expect(document.querySelector(".driver-live-region")).toBeNull();
    expect(document.querySelector("[class*=driver-]")).toBeNull();
    expect(document.querySelector("#intro")!.hasAttribute("aria-haspopup")).toBe(false);
    expect(document.body.className).toBe("");
    expect(hooks.onDestroyStarted).not.toHaveBeenCalled();
    expect(hooks.onDestroyed).not.toHaveBeenCalled();
    expect(hooks.onDeselected).not.toHaveBeenCalled();
    expect(d.getConfig().steps).toHaveLength(1);
  });

  it("starts the new steps from scratch on drive()", async () => {
    const onHighlightStarted = vi.fn();
    const onDeselected = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onHighlightStarted, onDeselected });
    d.drive(1);
    await nextFrame();

    d.setSteps([{ element: "#card-1", popover: { title: "New" } }]);
    d.drive();
    await nextFrame();

    expect(popoverTitle()).toBe("New");
    expect(d.getPreviousStep()).toBeUndefined();
    expect(onDeselected).not.toHaveBeenCalled();
    expect(document.querySelectorAll(".driver-overlay")).toHaveLength(1);
    expect(document.querySelectorAll(".driver-popover")).toHaveLength(1);
    expect(document.querySelectorAll(".driver-live-region")).toHaveLength(1);

    d.destroy();
    expect(document.querySelector("[class*=driver-]")).toBeNull();
  });

  it("ends a tour that is still waiting for its first element", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#later", waitForElement: 500, popover: { title: "Later" } }],
    });
    d.drive();
    await nextFrame();
    expect(popoverEl()).not.toBeNull();

    d.setSteps(SAMPLE_STEPS);

    expect(popoverEl()).toBeNull();
    expect(document.getElementById("driver-dummy-element")).toBeNull();
    expect(d.isActive()).toBe(false);
  });

  it("leaves another instance's tour alone when called on an idle one", async () => {
    const active = createDriver({ animate: false, steps: SAMPLE_STEPS });
    active.drive();
    await nextFrame();

    const idle = createDriver({ animate: false });
    idle.setSteps(SAMPLE_STEPS);

    expect(active.isActive()).toBe(true);
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(popoverEl()).not.toBeNull();
    active.destroy();
  });
});

describe("onHighlighted signal", () => {
  it("aborts when the step is left", async () => {
    const signals: AbortSignal[] = [];
    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onHighlighted: (_el, _step, opts) => {
        signals.push(opts.signal!);
      },
    });
    d.drive();
    await nextFrame();
    expect(signals[0].aborted).toBe(false);

    d.moveNext();
    await nextFrame();

    expect(signals[0].aborted).toBe(true);
    expect(signals[1].aborted).toBe(false);
  });

  it("aborts when the tour is destroyed", async () => {
    let signal: AbortSignal | undefined;
    const d = createDriver({
      animate: false,
      onHighlighted: (_el, _step, opts) => {
        signal = opts.signal;
      },
    });
    d.highlight({ element: "#intro", popover: { title: "Hi" } });
    await nextFrame();

    d.destroy();

    expect(signal?.aborted).toBe(true);
  });
});

describe("listeners and observers", () => {
  type Listener = { target: EventTarget; type: string; listener: unknown; capture: boolean; signal?: AbortSignal };

  function trackListeners() {
    const live: Listener[] = [];
    const captureOf = (options: unknown) =>
      typeof options === "boolean" ? options : !!(options as AddEventListenerOptions | undefined)?.capture;

    for (const target of [window, document]) {
      const add = target.addEventListener.bind(target);
      const remove = target.removeEventListener.bind(target);
      vi.spyOn(target, "addEventListener").mockImplementation((type: string, listener: any, options?: any) => {
        live.push({ target, type, listener, capture: captureOf(options), signal: options?.signal });
        add(type, listener, options);
      });
      vi.spyOn(target, "removeEventListener").mockImplementation((type: string, listener: any, options?: any) => {
        const index = live.findIndex(
          entry =>
            entry.target === target &&
            entry.type === type &&
            entry.listener === listener &&
            entry.capture === captureOf(options)
        );
        if (index !== -1) {
          live.splice(index, 1);
        }
        remove(type, listener, options);
      });
    }

    return () => live.filter(entry => !entry.signal?.aborted);
  }

  function trackObservers() {
    const live = new Set<object>();
    const Original = window.MutationObserver;
    class Tracked extends Original {
      observe(target: Node, options?: MutationObserverInit) {
        live.add(this);
        super.observe(target, options);
      }
      disconnect() {
        live.delete(this);
        super.disconnect();
      }
    }
    class TrackedResize {
      observe() {
        live.add(this);
      }
      unobserve() {}
      disconnect() {
        live.delete(this);
      }
    }
    vi.stubGlobal("MutationObserver", Tracked);
    vi.stubGlobal("ResizeObserver", TrackedResize);

    return live;
  }

  it("are balanced across a tour", async () => {
    const liveListeners = trackListeners();
    const liveObservers = trackObservers();

    const d = createDriver({
      animate: false,
      allowedElements: ".page-header",
      onElementMissing: () => {},
      steps: [
        { ...SAMPLE_STEPS[0], advanceOn: "click" },
        { ...SAMPLE_STEPS[1], advanceOn: { event: ["input", "keydown"] } },
        { element: "#later", waitForElement: 30, popover: { title: "Later" } },
        { popover: { title: "Modal" } },
      ],
    });
    d.drive();
    await nextFrame();
    expect(liveListeners().length).toBeGreaterThan(0);
    expect(liveObservers.size).toBeGreaterThan(0);

    d.moveNext();
    await nextFrame();
    d.moveNext();
    await new Promise(resolve => setTimeout(resolve, 60));
    await nextFrame();
    d.moveNext();
    await nextFrame();
    d.movePrevious();
    await nextFrame();
    d.destroy();

    expect(liveListeners()).toEqual([]);
    expect(liveObservers.size).toBe(0);
  });

  it("are balanced when destroyed while waiting for the first element", async () => {
    const liveListeners = trackListeners();
    const liveObservers = trackObservers();

    const d = createDriver({
      animate: false,
      steps: [{ element: "#later", waitForElement: 500, popover: { title: "Later" } }],
    });
    d.drive();
    await nextFrame();
    d.destroy();

    expect(liveListeners()).toEqual([]);
    expect(liveObservers.size).toBe(0);
  });

  it("are balanced after highlight() and after setSteps on an active tour", async () => {
    const liveListeners = trackListeners();
    const liveObservers = trackObservers();

    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.highlight({ element: "#intro", popover: { title: "Solo" } });
    await nextFrame();
    d.destroy();
    expect(liveListeners()).toEqual([]);
    expect(liveObservers.size).toBe(0);

    d.drive();
    await nextFrame();
    d.setSteps(SAMPLE_STEPS.slice(1));
    d.drive();
    await nextFrame();
    d.destroy();
    expect(liveListeners()).toEqual([]);
    expect(liveObservers.size).toBe(0);
  });
});

describe("console messages", () => {
  it("stays silent across an ordinary tour", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();
    d.refresh();
    await nextFrame();
    d.destroy();

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});

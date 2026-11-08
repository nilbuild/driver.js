import { describe, expect, it, vi } from "vitest";
import {
  createDriver,
  nextFrame,
  popoverDescription,
  popoverEl,
  popoverTitle,
  pressKey,
  SAMPLE_STEPS,
  useDriverHarness,
} from "./utils";

useDriverHarness();

describe("lifecycle", () => {
  it("is inactive before anything is highlighted", () => {
    const d = createDriver();
    expect(d.isActive()).toBe(false);
    expect(popoverEl()).toBeNull();
  });

  it("activates and renders a popover when highlighting an element", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro", description: "The intro paragraph" } });

    expect(d.isActive()).toBe(true);
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(popoverTitle()).toBe("Intro");
    expect(popoverDescription()).toBe("The intro paragraph");
  });

  it("marks the highlighted element as active and exposes it", () => {
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

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

  it("destroys instead of driving an out-of-range step index", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive(99);

    expect(d.isActive()).toBe(false);
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

  it("passes an undefined element to onDestroyStarted for a dummy highlight", async () => {
    const onDestroyStarted = vi.fn();
    const d = createDriver({ animate: false, onDestroyStarted });
    d.highlight({ popover: { title: "Modal" } });
    await nextFrame();

    pressKey("Escape");

    expect(onDestroyStarted).toHaveBeenCalledTimes(1);
    expect(onDestroyStarted.mock.calls[0][0]).toBeUndefined();
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

  it("keeps the new tour when the replaced instance is destroyed later", () => {
    const hint = createDriver({ animate: false });
    hint.highlight({ element: "#intro", popover: { title: "Hint" } });

    const tour = createDriver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour" } }] });
    tour.drive();
    hint.destroy();

    expect(tour.isActive()).toBe(true);
    expect(popoverTitle()).toBe("Tour");
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(document.querySelector("#card-1")?.classList.contains("driver-active-element")).toBe(true);
  });

  it("does not tear itself down when moving between its own steps", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    d.moveNext();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(1);
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

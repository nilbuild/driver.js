import { describe, expect, it, vi } from "vitest";
import {
  createDriver,
  navButton,
  nextFrame,
  popoverEl,
  popoverTitle,
  SAMPLE_STEPS,
  traced,
  useDriverHarness,
} from "../utils";

useDriverHarness();

describe("hook order", () => {
  it("drive, next, previous", async () => {
    const { d, trace } = traced({ onDestroyStarted: undefined });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();
    d.movePrevious();
    await nextFrame();

    expect(trace).toMatchInlineSnapshot(`
      [
        "onHighlightStarted:Step 1:intro",
        "onHighlighted:Step 1:intro",
        "onDeselected:Step 1:intro",
        "onHighlightStarted:Step 2:card-1",
        "onHighlighted:Step 2:card-1",
        "onDeselected:Step 2:card-1",
        "onHighlightStarted:Step 1:intro",
        "onHighlighted:Step 1:intro",
      ]
    `);
  });

  it("destroy() skips onDestroyStarted", async () => {
    const { d, trace } = traced();
    d.drive();
    await nextFrame();
    trace.length = 0;
    d.destroy();

    expect(trace).toMatchInlineSnapshot(`
      [
        "onDeselected:Step 1:intro (api)",
        "onDestroyed:Step 1:intro (api)",
      ]
    `);
  });

  it("close button with onDestroyStarted that destroys", async () => {
    const { d, trace } = traced({}, { onDestroyStarted: () => d.destroy() });
    d.drive();
    await nextFrame();
    trace.length = 0;

    navButton("close")!.click();

    expect(d.isActive()).toBe(false);
    expect(trace).toEqual([
      "onDestroyStarted:Step 1:intro (close)",
      "onDeselected:Step 1:intro (close)",
      "onDestroyed:Step 1:intro (close)",
    ]);
  });

  it("onDestroyStarted that does not destroy keeps the tour", async () => {
    const { d, trace } = traced();
    d.drive();
    await nextFrame();
    trace.length = 0;
    navButton("close")!.click();

    expect(d.isActive()).toBe(true);
    expect(trace).toMatchInlineSnapshot(`
      [
        "onDestroyStarted:Step 1:intro (close)",
      ]
    `);
  });

  it("done on the last step", async () => {
    const { d, trace } = traced({ onDestroyStarted: undefined });
    d.drive(2);
    await nextFrame();
    trace.length = 0;
    navButton("next")!.click();

    expect(d.isActive()).toBe(false);
    expect(trace).toMatchInlineSnapshot(`
      [
        "onDeselected:Step 3:UL (done)",
        "onDestroyed:Step 3:UL (done)",
      ]
    `);
  });

  it("moveNext past the last step with onDestroyStarted", async () => {
    const { d, trace } = traced({}, { onDestroyStarted: () => d.destroy() });
    d.drive(2);
    await nextFrame();
    trace.length = 0;
    d.moveNext();

    expect(trace).toMatchInlineSnapshot(`
      [
        "onDestroyStarted:Step 3:UL (done)",
        "onDeselected:Step 3:UL (done)",
        "onDestroyed:Step 3:UL (done)",
      ]
    `);
  });

  it("highlight(), a second highlight(), then destroy()", async () => {
    const { d, trace } = traced({ steps: undefined });
    d.highlight({ element: "#intro", popover: { title: "One" } });
    await nextFrame();
    d.highlight({ element: "#card-1", popover: { title: "Two" } });
    await nextFrame();
    d.highlight({ popover: { title: "Modal" } });
    await nextFrame();
    d.destroy();

    expect(trace).toMatchInlineSnapshot(`
      [
        "onHighlightStarted:One:intro",
        "onHighlighted:One:intro",
        "onDeselected:One:intro",
        "onHighlightStarted:Two:card-1",
        "onHighlighted:Two:card-1",
        "onDeselected:Two:card-1",
        "onHighlightStarted:Modal:none",
        "onHighlighted:Modal:none",
        "onDeselected:Modal:none (api)",
        "onDestroyed:Modal:none (api)",
      ]
    `);
  });

  it("destroy before the first highlight settles", () => {
    const { d, trace } = traced();
    d.drive();
    d.destroy();

    expect(trace).toMatchInlineSnapshot(`
      [
        "onHighlightStarted:Step 1:intro",
      ]
    `);
  });
});

describe("hook arguments", () => {
  it("runs onDoneClick instead of onNextClick on the final step", () => {
    const onDoneClick = vi.fn();
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDoneClick, onNextClick });
    d.drive(SAMPLE_STEPS.length - 1);
    navButton("next")?.click();

    expect(onDoneClick).toHaveBeenCalledTimes(1);
    expect(onNextClick).not.toHaveBeenCalled();

    const [element, step, options] = onDoneClick.mock.calls[0];
    expect(element).toBe(document.querySelector(".feature-list"));
    expect(step.popover?.title).toBe("Step 3");
    expect(options.driver).toBe(d);
  });

  it("runs onCloseClick instead of destroying when the close button is clicked", () => {
    const onCloseClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onCloseClick });
    d.drive();
    navButton("close")?.click();

    expect(onCloseClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);

    const [element, step, options] = onCloseClick.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(step.popover?.title).toBe("Step 1");
    expect(options.driver).toBe(d);
  });

  it("fires onHighlightStarted synchronously with the element, step and options", () => {
    const onHighlightStarted = vi.fn();
    const d = createDriver({ animate: false, onHighlightStarted });
    d.highlight({ element: "#intro", popover: { title: "Intro" } });

    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
    const [element, step, options] = onHighlightStarted.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(step.popover?.title).toBe("Intro");
    expect(options).toMatchObject({ config: expect.any(Object), state: expect.any(Object) });
    expect(options.driver).toBe(d);
  });

  it("passes the active state to onDestroyed", async () => {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onDestroyed });
    d.drive(1);
    await nextFrame();
    d.destroy();

    const [, , options] = onDestroyed.mock.calls[0];
    expect(options.state.activeIndex).toBe(1);
    expect(options.state.activeElement).toBe(document.querySelector("#card-1"));
  });

  it("supports step-level hooks", () => {
    const onHighlightStarted = vi.fn();
    const d = createDriver({ animate: false });
    d.highlight({ element: "#intro", popover: { title: "Intro" }, onHighlightStarted });

    expect(onHighlightStarted).toHaveBeenCalledTimes(1);
  });

  it("fires onDeselected between two steps without an element", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({
      animate: false,
      onDeselected,
      steps: [{ popover: { title: "One" } }, { popover: { title: "Two" } }],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDeselected.mock.calls[0][0]).toBeUndefined();
    expect(onDeselected.mock.calls[0][1].popover.title).toBe("One");
  });

  it("fires onDeselected between two steps on the same element", async () => {
    const onDeselected = vi.fn();
    const d = createDriver({
      animate: false,
      onDeselected,
      steps: [
        { element: "#intro", popover: { title: "One" } },
        { element: "#intro", popover: { title: "Two" } },
      ],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    expect(onDeselected).toHaveBeenCalledTimes(1);
    expect(onDeselected.mock.calls[0][1].popover.title).toBe("One");
  });
});

describe("navigation from inside hooks", () => {
  it("moveNext() inside onHighlighted lands on the next step and runs its hooks (A1)", async () => {
    let hasMoved = false;
    const { d, trace } = traced(
      { onDestroyStarted: undefined },
      {
        onHighlighted: () => {
          if (!hasMoved) {
            hasMoved = true;
            d.moveNext();
          }
        },
      }
    );
    d.drive();
    await nextFrame();
    await nextFrame();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
    expect(trace).toContain("onHighlighted:Step 2:card-1");
    expect(d.getState("__activeStep").popover.title).toBe("Step 2");
    expect(d.getState("__activeElement")).toBe(document.querySelector("#card-1"));

    navButton("next")!.click();
    expect(d.getActiveIndex()).toBe(2);
  });

  it("drive(2) inside onHighlighted lands on that step (A1)", async () => {
    let hasMoved = false;
    const { d, trace } = traced(
      { onDestroyStarted: undefined },
      {
        onHighlighted: () => {
          if (!hasMoved) {
            hasMoved = true;
            d.drive(2);
          }
        },
      }
    );
    d.drive();
    await nextFrame();
    await nextFrame();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(2);
    expect(trace).toContain("onHighlighted:Step 3:UL");
    expect(d.getState("__activeStep").popover.title).toBe("Step 3");
  });

  it("destroy() inside onHighlighted leaves no state behind (A2)", async () => {
    const { d } = traced({ onDestroyStarted: undefined }, { onHighlighted: () => d.destroy() });
    d.drive();
    await nextFrame();
    await nextFrame();

    expect(d.isActive()).toBe(false);
    expect(d.getState()).toEqual({});
    expect(popoverEl()).toBeNull();
    expect(document.querySelector(".driver-overlay")).toBeNull();
  });

  it("moveNext() inside onDestroyStarted keeps the tour going", async () => {
    const { d } = traced({}, { onDestroyStarted: () => d.moveNext() });
    d.drive();
    await nextFrame();
    navButton("close")!.click();
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(1);
  });
});

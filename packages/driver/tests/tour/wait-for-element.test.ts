import { describe, expect, it, vi } from "vitest";
import { append, createDriver, nextFrame, popoverEl, popoverTitle, tick, useDriverHarness } from "../utils";

useDriverHarness();

function appendElement(id: string): void {
  const element = document.createElement("div");
  element.id = id;
  document.body.appendChild(element);
}

describe("waitForElement", () => {
  it("keeps the current step and its popover in a waiting state until the next element appears", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: 500, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(popoverEl()?.style.display).toBe("block");
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);
    expect(popoverEl()?.getAttribute("aria-busy")).toBe("true");
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");
    expect(document.getElementById("intro")?.classList.contains("driver-active-element")).toBe(true);

    appendElement("late");
    await tick();

    expect(popoverEl()?.style.display).toBe("block");
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);
    expect(popoverTitle()).toBe("Step 2");
    expect(d.getActiveIndex()).toBe(1);
    expect(d.getActiveElement()?.id).toBe("late");
  });

  it("waits for the first step's element on the initial drive", async () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#late", waitForElement: 500, popover: { title: "Step 1" } }],
    });
    d.drive();
    expect(popoverTitle()).toBe("Step 1");
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);

    appendElement("late");
    await tick();

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");
  });

  it("applies the driver-level waitForElement to every step", async () => {
    const d = createDriver({
      animate: false,
      waitForElement: 500,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    expect(d.getActiveIndex()).toBe(0);

    appendElement("late");
    await tick();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("falls back to the centered popover when the wait times out", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#never", waitForElement: 40, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    expect(popoverTitle()).toBe("Step 1");
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);

    await tick(80);

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverEl()?.style.display).toBe("block");
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);
    expect(popoverTitle()).toBe("Step 2");
    expect(d.getActiveElement()?.id).toBe("driver-dummy-element");
  });

  it("skips the step when the wait times out and skipMissingElement is set", async () => {
    const d = createDriver({
      animate: false,
      skipMissingElement: true,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#never", waitForElement: 40, popover: { title: "Step 2" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive();
    d.moveNext();
    expect(popoverTitle()).toBe("Step 1");

    await tick(80);

    expect(d.getActiveIndex()).toBe(2);
    expect(popoverTitle()).toBe("Step 3");
  });

  it("cancels a pending wait when the tour is destroyed", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: 500, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    d.destroy();

    appendElement("late");
    await tick();

    expect(d.isActive()).toBe(false);
    expect(popoverTitle()).toBeUndefined();
  });

  it("cancels a pending wait when navigating elsewhere", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: 500, popover: { title: "Step 2" } },
        { element: "#card-1", popover: { title: "Step 3" } },
      ],
    });
    d.drive();
    d.moveNext();
    d.moveTo(2);
    expect(popoverTitle()).toBe("Step 3");

    appendElement("late");
    await tick();

    expect(d.getActiveIndex()).toBe(2);
    expect(popoverTitle()).toBe("Step 3");
  });

  it("advances through a click-driven step into a waiting step", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#card-1", advanceOnClick: true, popover: { title: "Step 1" } },
        { element: "#modal", waitForElement: 500, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    await nextFrame();

    d.advance();
    setTimeout(() => appendElement("modal"), 20);
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverTitle()).toBe("Step 1");

    await tick(60);

    expect(d.getActiveIndex()).toBe(1);
    expect(popoverTitle()).toBe("Step 2");
    expect(d.getActiveElement()?.id).toBe("modal");
  });

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

  it("waits as long as it takes with Infinity", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: Infinity, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    await tick(30);
    expect(d.getActiveIndex()).toBe(0);

    appendElement("late");
    await nextFrame();
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("treats a wait too long for a timer as endless rather than over at once", async () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: 3e9, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    await tick(30);
    expect(d.getActiveIndex()).toBe(0);
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);
  });
});

describe("onWaitingForElement", () => {
  it("reports the wait for the next step and ends it when the element appears", async () => {
    const onWaitingForElement = vi.fn();
    const d = createDriver({
      animate: false,
      onWaitingForElement,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#late", waitForElement: 500, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();

    expect(onWaitingForElement).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onWaitingForElement.mock.calls[0];
    expect(element).toBeUndefined();
    expect(step.element).toBe("#late");
    expect(opts).toMatchObject({ index: 1 });
    expect(opts.signal.aborted).toBe(false);

    appendElement("late");
    await tick(50);

    expect(opts.signal.aborted).toBe(true);
    expect(d.getActiveIndex()).toBe(1);
  });

  it("reports the wait for the first step", async () => {
    const onWaitingForElement = vi.fn();
    const d = createDriver({
      animate: false,
      steps: [{ element: "#late", waitForElement: 500, onWaitingForElement, popover: { title: "Step 1" } }],
    });
    d.drive();

    expect(onWaitingForElement).toHaveBeenCalledTimes(1);
    expect(onWaitingForElement.mock.calls[0][2]).toMatchObject({ index: 0 });

    d.destroy();
    expect(onWaitingForElement.mock.calls[0][2].signal.aborted).toBe(true);
  });

  it("ends the wait when it times out", async () => {
    const onWaitingForElement = vi.fn();
    const d = createDriver({
      animate: false,
      onWaitingForElement,
      steps: [
        { element: "#intro", popover: { title: "Step 1" } },
        { element: "#never", waitForElement: 30, popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    d.moveNext();
    const { signal } = onWaitingForElement.mock.calls[0][2];

    await tick(60);
    expect(signal.aborted).toBe(true);
  });

  it("is not called when the element is already there", async () => {
    const onWaitingForElement = vi.fn();
    const d = createDriver({
      animate: false,
      waitForElement: 500,
      onWaitingForElement,
      steps: [{ element: "#intro", popover: { title: "Step 1" } }],
    });
    d.drive();
    await nextFrame();

    expect(onWaitingForElement).not.toHaveBeenCalled();
  });
});

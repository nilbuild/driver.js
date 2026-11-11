import { describe, expect, it } from "vitest";
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
});

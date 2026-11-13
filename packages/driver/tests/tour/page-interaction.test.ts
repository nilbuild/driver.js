import { describe, expect, it, vi } from "vitest";
import { append, createDriver, nextFrame, pressKey, SAMPLE_STEPS, useDriverHarness } from "../utils";

// jsdom's events are never trusted; driver.js only stops what the user does
vi.mock("../../src/interaction/trust", () => ({ isUserEvent: () => true }));

useDriverHarness();

const isInteractive = () => document.body.classList.contains("driver-page-interactive");

function clickOnBody() {
  const press = new MouseEvent("pointerdown", { bubbles: true, cancelable: true });
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  document.body.dispatchEvent(press);
  document.body.dispatchEvent(click);
  return click;
}

describe("allowPageInteraction", () => {
  it("marks the page usable for the steps that ask, and clears it when the tour ends", async () => {
    const d = createDriver({
      animate: false,
      steps: [SAMPLE_STEPS[0], { ...SAMPLE_STEPS[1], allowPageInteraction: true }],
    });
    d.drive();
    await nextFrame();
    expect(isInteractive()).toBe(false);

    d.moveNext();
    await nextFrame();
    expect(isInteractive()).toBe(true);

    d.movePrevious();
    await nextFrame();
    expect(isInteractive()).toBe(false);

    d.moveNext();
    await nextFrame();
    d.destroy();
    expect(isInteractive()).toBe(false);
  });

  it("lets clicks on the page through", async () => {
    const blocked = createDriver({ animate: false, steps: SAMPLE_STEPS });
    blocked.drive();
    await nextFrame();
    expect(clickOnBody().defaultPrevented).toBe(true);
    blocked.destroy();

    const free = createDriver({ animate: false, allowPageInteraction: true, steps: SAMPLE_STEPS });
    free.drive();
    await nextFrame();
    expect(clickOnBody().defaultPrevented).toBe(false);
  });

  it("leaves arrow keys typed into the page to the page", async () => {
    const field = append("search", "input");
    const d = createDriver({ animate: false, allowPageInteraction: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    field.focus();
    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(0);

    field.blur();
    pressKey("ArrowRight");
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("doesn't keep Tab inside the step", async () => {
    const field = append("search", "input");
    const d = createDriver({ animate: false, allowPageInteraction: true, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    field.focus();
    const tab = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
    field.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(false);
  });
});

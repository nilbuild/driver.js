import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const NO_INTERACTION_CLASS = "driver-no-interaction";

const PARENT_CLASS = "driver-active-element-parent";

const NESTED_HTML = `
  <div id="container-a"><button id="child-a" type="button">A</button></div>
  <div id="container-b"><button id="child-b" type="button">B</button></div>
  <button id="top-level" type="button">Top</button>
`;

describe("active element parent", () => {
  it("locks scrolling on the highlighted element's parent", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#child-a" }] });
    d.drive();

    expect(document.getElementById("container-a")?.classList.contains(PARENT_CLASS)).toBe(true);
  });

  it("moves the lock to the new parent when highlighting a different branch", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({
      animate: false,
      steps: [{ element: "#child-a" }, { element: "#child-b" }],
    });
    d.drive();
    navButton("next")?.click();

    expect(document.getElementById("container-a")?.classList.contains(PARENT_CLASS)).toBe(false);
    expect(document.getElementById("container-b")?.classList.contains(PARENT_CLASS)).toBe(true);
  });

  it("never locks the body element", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#top-level" }] });
    d.drive();

    expect(document.body.classList.contains(PARENT_CLASS)).toBe(false);
  });

  it("releases the lock when the tour is destroyed", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#child-a" }] });
    d.drive();
    d.destroy();

    expect(document.getElementById("container-a")?.classList.contains(PARENT_CLASS)).toBe(false);
  });
});

describe("disableActiveInteraction", () => {
  it("leaves the active element interactive by default", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    expect(document.querySelector("#intro")?.classList.contains(NO_INTERACTION_CLASS)).toBe(false);
  });

  it("blocks interaction on the active element when enabled globally", () => {
    const d = createDriver({ animate: false, disableActiveInteraction: true, steps: SAMPLE_STEPS });
    d.drive();

    expect(document.querySelector("#intro")?.classList.contains(NO_INTERACTION_CLASS)).toBe(true);
  });

  it("honours a per-step disableActiveInteraction override", () => {
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", disableActiveInteraction: true, popover: { title: "Step 1" } },
        { element: "#card-1", popover: { title: "Step 2" } },
      ],
    });
    d.drive();
    expect(document.querySelector("#intro")?.classList.contains(NO_INTERACTION_CLASS)).toBe(true);

    navButton("next")?.click();
    expect(document.querySelector("#card-1")?.classList.contains(NO_INTERACTION_CLASS)).toBe(false);
  });
});

describe("step data", () => {
  it("exposes a step's data via getActiveStep", () => {
    const d = createDriver({
      animate: false,
      steps: [{ element: "#intro", data: { id: 42, label: "intro" }, popover: { title: "Step 1" } }],
    });
    d.drive();

    expect(d.getActiveStep()?.data).toEqual({ id: 42, label: "intro" });
  });

  it("passes the step's data through to lifecycle hooks", () => {
    const onHighlightStarted = vi.fn();
    const d = createDriver({
      animate: false,
      steps: [{ element: "#intro", data: { id: 7 }, popover: { title: "Step 1" }, onHighlightStarted }],
    });
    d.drive();

    const [, step] = onHighlightStarted.mock.calls[0];
    expect(step.data).toEqual({ id: 7 });
  });
});

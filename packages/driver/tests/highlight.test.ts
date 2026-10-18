import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const NO_INTERACTION_CLASS = "driver-no-interaction";

const PARENT_CLASS = "driver-active-element-parent";

const NO_SCROLL_CLASS = "driver-active-element-parent-no-scroll";

const NESTED_HTML = `
  <div id="container-a"><button id="child-a" type="button">A</button></div>
  <div id="container-b"><button id="child-b" type="button">B</button></div>
  <button id="top-level" type="button">Top</button>
`;

describe("active element parent marker", () => {
  it("marks the highlighted element's parent regardless of scrollability", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#child-a" }] });
    d.drive();

    expect(document.getElementById("container-a")?.classList.contains(PARENT_CLASS)).toBe(true);
  });

  it("moves the marker to the new parent when highlighting a different branch", () => {
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

  it("never marks the body element", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#top-level" }] });
    d.drive();

    expect(document.body.classList.contains(PARENT_CLASS)).toBe(false);
  });

  it("releases the marker when the tour is destroyed", () => {
    document.body.innerHTML = NESTED_HTML;
    const d = createDriver({ animate: false, steps: [{ element: "#child-a" }] });
    d.drive();
    d.destroy();

    expect(document.getElementById("container-a")?.classList.contains(PARENT_CLASS)).toBe(false);
  });
});

describe("active element parent scroll lock", () => {
  it("does not lock a non-scrollable parent so positioned children are not clipped", () => {
    document.body.innerHTML = `
      <div id="dropdown" style="position: relative">
        <button id="dropdown-toggle" type="button">Toggle</button>
      </div>
    `;
    const d = createDriver({ animate: false, steps: [{ element: "#dropdown-toggle" }] });
    d.drive();

    const dropdown = document.getElementById("dropdown");
    expect(dropdown?.classList.contains(PARENT_CLASS)).toBe(true);
    expect(dropdown?.classList.contains(NO_SCROLL_CLASS)).toBe(false);
  });

  it("locks a genuinely scrollable parent", () => {
    document.body.innerHTML = `
      <div id="scroll-area" style="overflow: auto">
        <button id="scroll-child" type="button">Child</button>
      </div>
    `;
    const d = createDriver({ animate: false, steps: [{ element: "#scroll-child" }] });
    d.drive();

    expect(document.getElementById("scroll-area")?.classList.contains(NO_SCROLL_CLASS)).toBe(true);
  });

  it("releases the scroll lock when the tour is destroyed", () => {
    document.body.innerHTML = `
      <div id="scroll-area" style="overflow: auto">
        <button id="scroll-child" type="button">Child</button>
      </div>
    `;
    const d = createDriver({ animate: false, steps: [{ element: "#scroll-child" }] });
    d.drive();
    d.destroy();

    expect(document.getElementById("scroll-area")?.classList.contains(NO_SCROLL_CLASS)).toBe(false);
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

describe("single element highlight close button", () => {
  it("closes the popover when the close button is clicked", () => {
    const d = createDriver({ animate: false, allowClose: true });
    d.highlight({
      element: "#intro",
      popover: { title: "Highlighted", showButtons: ["close"] },
    });

    expect(d.isActive()).toBe(true);

    navButton("close")?.click();

    expect(d.isActive()).toBe(false);
  });

  it("runs a custom onCloseClick instead of closing when provided", () => {
    const onCloseClick = vi.fn();
    const d = createDriver({ animate: false, allowClose: true });
    d.highlight({
      element: "#intro",
      popover: { title: "Highlighted", showButtons: ["close"], onCloseClick },
    });

    navButton("close")?.click();

    expect(onCloseClick).toHaveBeenCalledTimes(1);
    expect(d.isActive()).toBe(true);
  });

  it("keeps the popover open on close click when allowClose is false", () => {
    const d = createDriver({ animate: false, allowClose: false });
    d.highlight({
      element: "#intro",
      popover: { title: "Highlighted", showButtons: ["close"] },
    });

    navButton("close")?.click();

    expect(d.isActive()).toBe(true);
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

describe("aria attributes on the highlighted element", () => {
  it("points the active element at the popover, then restores the previous values", () => {
    document.body.innerHTML = `
      <button id="menu-btn" type="button" aria-controls="menu" aria-expanded="false" aria-haspopup="true">Menu</button>
    `;
    const d = createDriver({ animate: false, steps: [{ element: "#menu-btn", popover: { title: "Menu" } }] });
    d.drive();

    const button = document.getElementById("menu-btn");
    expect(button?.getAttribute("aria-controls")).toBe("driver-popover-content");
    expect(button?.getAttribute("aria-expanded")).toBe("true");
    expect(button?.getAttribute("aria-haspopup")).toBe("dialog");

    d.destroy();

    expect(button?.getAttribute("aria-controls")).toBe("menu");
    expect(button?.getAttribute("aria-expanded")).toBe("false");
    expect(button?.getAttribute("aria-haspopup")).toBe("true");
  });

  it("drops the tour attributes when the element had none", () => {
    document.body.innerHTML = `<button id="plain" type="button">Plain</button>`;
    const d = createDriver({ animate: false, steps: [{ element: "#plain", popover: { title: "Plain" } }] });
    d.drive();
    d.destroy();

    const button = document.getElementById("plain");
    expect(button?.hasAttribute("aria-controls")).toBe(false);
    expect(button?.hasAttribute("aria-expanded")).toBe(false);
    expect(button?.hasAttribute("aria-haspopup")).toBe(false);
  });

  it("restores the element left behind when the highlight moves", () => {
    document.body.innerHTML = `
      <button id="first" type="button" aria-controls="panel-a" aria-expanded="false">First</button>
      <button id="second" type="button" aria-haspopup="menu">Second</button>
    `;
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#first", popover: { title: "First" } },
        { element: "#second", popover: { title: "Second" } },
      ],
    });
    d.drive();
    navButton("next")?.click();

    const first = document.getElementById("first");
    const second = document.getElementById("second");
    expect(first?.getAttribute("aria-controls")).toBe("panel-a");
    expect(first?.getAttribute("aria-expanded")).toBe("false");
    expect(first?.hasAttribute("aria-haspopup")).toBe(false);
    expect(second?.getAttribute("aria-controls")).toBe("driver-popover-content");
    expect(second?.getAttribute("aria-expanded")).toBe("true");
    expect(second?.getAttribute("aria-haspopup")).toBe("dialog");

    navButton("prev")?.click();

    expect(first?.getAttribute("aria-controls")).toBe("driver-popover-content");
    expect(second?.getAttribute("aria-haspopup")).toBe("menu");
    expect(second?.hasAttribute("aria-controls")).toBe(false);
    expect(second?.hasAttribute("aria-expanded")).toBe(false);
  });

  it("leaves attributes alone on an element the tour never highlights", () => {
    document.body.innerHTML = `
      <button id="target" type="button">Target</button>
      <button id="other" type="button" aria-controls="sidebar" aria-expanded="false">Other</button>
    `;
    const d = createDriver({ animate: false, steps: [{ element: "#target", popover: { title: "Target" } }] });
    d.drive();

    const other = document.getElementById("other");
    expect(other?.getAttribute("aria-controls")).toBe("sidebar");
    expect(other?.getAttribute("aria-expanded")).toBe("false");

    d.destroy();

    expect(other?.getAttribute("aria-controls")).toBe("sidebar");
    expect(other?.getAttribute("aria-expanded")).toBe("false");
  });

  it("restores the same element again after a later tour", () => {
    document.body.innerHTML = `<button id="menu-btn" type="button" aria-controls="menu">Menu</button>`;
    const d = createDriver({ animate: false, steps: [{ element: "#menu-btn", popover: { title: "Menu" } }] });
    d.drive();
    d.destroy();
    d.drive();

    expect(document.getElementById("menu-btn")?.getAttribute("aria-controls")).toBe("driver-popover-content");

    d.destroy();

    expect(document.getElementById("menu-btn")?.getAttribute("aria-controls")).toBe("menu");
  });

  it("keeps the original values when two steps highlight the same element", () => {
    document.body.innerHTML = `<button id="menu-btn" type="button" aria-controls="menu">Menu</button>`;
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#menu-btn", popover: { title: "One" } },
        { element: "#menu-btn", popover: { title: "Two" } },
      ],
    });
    d.drive();
    navButton("next")?.click();

    expect(document.getElementById("menu-btn")?.getAttribute("aria-controls")).toBe("driver-popover-content");

    d.destroy();

    expect(document.getElementById("menu-btn")?.getAttribute("aria-controls")).toBe("menu");
  });
});

describe("aria attributes on the dummy element", () => {
  it("leaves the dummy element of an element-less step without aria", () => {
    const d = createDriver({ animate: false, steps: [{ popover: { title: "Centered" } }] });
    d.drive();

    const dummy = document.getElementById("driver-dummy-element");
    expect(dummy).not.toBeNull();
    expect(dummy?.hasAttribute("aria-controls")).toBe(false);
    expect(dummy?.hasAttribute("aria-expanded")).toBe(false);
    expect(dummy?.hasAttribute("aria-haspopup")).toBe(false);
  });
});

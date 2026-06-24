import { describe, expect, it } from "vitest";
import { createDriver, navButton, useDriverHarness } from "./utils";

useDriverHarness();

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

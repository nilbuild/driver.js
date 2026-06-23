import { describe, expect, it } from "vitest";
import { createDriver, popoverDescription, popoverEl, popoverTitle, useDriverHarness } from "./utils";

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

import { afterEach, describe, expect, it } from "vitest";
import { createDriver, navButton, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));
const isPopoverNudged = () => !!popoverEl()?.classList.contains("driver-popover-nudge");

async function start(config: Parameters<typeof createDriver>[0] = {}) {
  const d = createDriver({ animate: false, steps: SAMPLE_STEPS, ...config });
  d.drive();
  await nextFrame();
  return d;
}

describe("nudge", () => {
  afterEach(() => {
    document.documentElement.style.removeProperty("--driver-nudge-duration");
  });

  it("shakes the popover", async () => {
    const d = await start();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("changes the popover and shakes it in one call", async () => {
    const d = await start();

    d.nudge({ description: "Not quite" });

    expect(popoverEl()?.querySelector(".driver-popover-description")?.textContent).toBe("Not quite");
    expect(isPopoverNudged()).toBe(true);
  });

  it("keeps an earlier change when called without one", async () => {
    const d = await start();
    d.updatePopover({ description: "Not quite" });

    d.nudge();

    expect(popoverEl()?.querySelector(".driver-popover-description")?.textContent).toBe("Not quite");
  });

  it("never touches the highlighted element itself", async () => {
    const d = await start();
    const element = document.querySelector("#intro")!;
    const before = element.getAttribute("class");

    d.nudge();

    expect(element.getAttribute("class")).toBe(before);
    expect(element.getAttribute("style")).toBeNull();
  });

  it("clears itself after the duration when no animation runs", async () => {
    document.documentElement.style.setProperty("--driver-nudge-duration", "40ms");
    const d = await start();

    d.nudge();
    await tick(300);

    expect(isPopoverNudged()).toBe(false);
  });

  it("restarts instead of stacking", async () => {
    const d = await start();

    d.nudge();
    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("shakes the popover of a centered step", async () => {
    const d = createDriver({ animate: false, steps: [{ popover: { title: "Centered" } }] });
    d.drive();
    await nextFrame();

    d.nudge();

    expect(isPopoverNudged()).toBe(true);
  });

  it("is cleaned up on destroy", async () => {
    const d = await start();
    d.nudge();
    d.destroy();

    expect(popoverEl()).toBeNull();
  });

  describe("with a message", () => {
    const feedback = () => popoverEl()?.querySelector<HTMLElement>(".driver-popover-feedback");
    const liveRegion = () => document.querySelector(".driver-live-region")?.textContent;
    const description = () => popoverEl()?.querySelector(".driver-popover-description")?.textContent;

    const actionSteps = [
      { ...SAMPLE_STEPS[0], popover: { title: "Act", description: "Why", instruction: "Do it." } },
      ...SAMPLE_STEPS.slice(1),
    ];

    it("shows a feedback line, shakes, and leaves the rest of the popover alone", async () => {
      const d = await start({ steps: actionSteps });

      d.nudge("Not that one.");

      expect(feedback()?.textContent).toBe("Not that one.");
      expect(feedback()?.style.display).toBe("");
      expect(isPopoverNudged()).toBe(true);
      expect(description()).toBe("Why");
      expect(popoverEl()?.querySelector(".driver-popover-instruction-text")?.textContent).toBe("Do it.");
      expect(d.getActiveStep()?.popover?.instruction).toBe("Do it.");
    });

    it("sits between the instruction and the footer", async () => {
      const d = await start({ steps: actionSteps });
      d.nudge("Not that one.");

      const classes = Array.from(popoverEl()!.children).map(child => child.className.split(" ")[0]);
      expect(classes.slice(-3)).toEqual([
        "driver-popover-instruction",
        "driver-popover-feedback",
        "driver-popover-footer",
      ]);
    });

    it("announces the message to screen readers", async () => {
      const d = await start();

      d.nudge("Not <b>that</b> one.");

      expect(liveRegion()).toBe("Not that one.");
    });

    it("is replaced by the next message and cleared by a plain nudge", async () => {
      const d = await start();

      d.nudge("First");
      d.nudge("Second");
      expect(feedback()?.textContent).toBe("Second");

      d.nudge();
      expect(feedback()?.style.display).toBe("none");
      expect(feedback()?.textContent).toBe("");
    });

    it("is cleared by a nudge that patches the popover", async () => {
      const d = await start();

      d.nudge("First");
      d.nudge({ description: "Patched" });

      expect(feedback()?.style.display).toBe("none");
      expect(description()).toBe("Patched");
    });

    it("survives updatePopover() and the library's own nudges", async () => {
      const d = await start({ steps: actionSteps });

      d.nudge("Still here");
      d.updatePopover({ description: "Changed" });
      d.updatePopover();
      popoverEl()?.classList.remove("driver-popover-nudge");
      navButton("next")?.click();

      expect(isPopoverNudged()).toBe(true);
      expect(d.getActiveIndex()).toBe(0);
      expect(feedback()?.textContent).toBe("Still here");
    });

    it("is gone on the next step and when coming back", async () => {
      const d = await start();

      d.nudge("Only here");
      d.moveNext();
      await nextFrame();
      expect(feedback()).toBeFalsy();

      d.movePrevious();
      await nextFrame();
      expect(feedback()).toBeFalsy();
    });

    it("creates no feedback node for popovers that never had one", async () => {
      const d = await start();
      d.nudge();
      d.nudge({ description: "x" });

      expect(feedback()).toBeFalsy();
    });

    it("works in highlight()", async () => {
      const d = createDriver({ animate: false });
      d.highlight({ element: "#intro", popover: { title: "Solo" } });
      await nextFrame();

      d.nudge("Look here");

      expect(feedback()?.textContent).toBe("Look here");
    });

    it("does nothing without an active tour", () => {
      const d = createDriver({ animate: false, steps: SAMPLE_STEPS });

      expect(() => d.nudge()).not.toThrow();
      expect(() => d.nudge("Nobody home")).not.toThrow();
      expect(feedback()).toBeFalsy();
    });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { DriveStep, PopoverDOM } from "../src/driver";
import {
  createDriver,
  navButton,
  nextFrame,
  popoverEl,
  popoverTitle,
  pressKey,
  SAMPLE_STEPS,
  tick,
  useDriverHarness,
} from "./utils";

useDriverHarness();

const actionRow = () => document.querySelector<HTMLElement>(".driver-popover-action-text");
const actionText = () => actionRow()?.textContent?.trim();
const status = () => document.querySelector<HTMLElement>(".driver-popover-action-status");
const footer = () => document.querySelector<HTMLElement>(".driver-popover-footer");
const isActionPopover = () => !!popoverEl()?.classList.contains("driver-popover-action");
const liveRegion = () => document.querySelector(".driver-live-region");

function click(selector: string) {
  document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
}

function clickOverlay() {
  document.querySelector(".driver-overlay path")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
}

const actionStep = (extra: Partial<DriveStep> = {}, popover: DriveStep["popover"] = {}): DriveStep => ({
  ...SAMPLE_STEPS[0],
  ...extra,
  popover: { ...SAMPLE_STEPS[0].popover, action: "Click <b>Intro</b> to go on.", ...popover },
});

const withFirst = (step: DriveStep) => [step, ...SAMPLE_STEPS.slice(1)];

async function start(config: Parameters<typeof createDriver>[0], index = 0) {
  const d = createDriver({ animate: false, ...config });
  d.drive(index);
  await nextFrame();
  return d;
}

describe("popover.action", () => {
  describe("rendering", () => {
    it("shows the instruction between the description and the footer", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(actionRow()?.style.display).toBe("block");
      expect(actionRow()?.querySelector("b")?.textContent).toBe("Intro");
      expect(actionText()).toBe("Click Intro to go on.");
      expect(actionRow()?.previousElementSibling?.classList.contains("driver-popover-description")).toBe(true);
      expect(actionRow()?.nextElementSibling).toBe(footer());
    });

    it("marks the wrapper as an action popover", async () => {
      const d = await start({ steps: withFirst(actionStep()) });
      expect(isActionPopover()).toBe(true);

      d.moveNext();
      await nextFrame();
      expect(isActionPopover()).toBe(false);
    });

    it("shows a status in place of the next button", async () => {
      await start({ steps: [SAMPLE_STEPS[0], actionStep({ element: "#card-1" })] }, 1);

      expect(navButton("next")?.style.display).toBe("none");
      expect(status()?.style.display).toBe("inline-block");
      expect(status()?.textContent).toBe("Waiting for you");
      expect(status()?.getAttribute("role")).toBe("status");
      expect(status()?.tagName).toBe("SPAN");
      expect(navButton("prev")?.style.display).toBe("block");
      expect(navButton("close")?.style.display).toBe("block");
    });

    it("uses actionStatusText from the step, then the config", async () => {
      const d = await start({
        actionStatusText: "Your turn",
        steps: [actionStep(), actionStep({ element: "#card-1" }, { actionStatusText: "Go on" })],
      });
      expect(status()?.textContent).toBe("Your turn");

      d.moveNext();
      await nextFrame();
      expect(status()?.textContent).toBe("Go on");
    });

    it("hides the status when next is not in showButtons", async () => {
      await start({ showButtons: ["previous", "close"], steps: withFirst(actionStep()) });

      expect(actionRow()?.style.display).toBe("block");
      expect(status()?.style.display).toBe("none");
      expect(navButton("next")?.style.display).toBe("none");
    });

    it("adds no footer when showButtons is empty", async () => {
      await start({ showButtons: [], steps: withFirst(actionStep()) });

      expect(actionRow()?.style.display).toBe("block");
      expect(footer()?.style.display).toBe("none");
    });

    it("works without advanceOn", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(actionRow()?.style.display).toBe("block");
      expect(navButton("next")?.style.display).toBe("none");
    });

    it("shows the row on a single highlight without adding buttons", async () => {
      const d = createDriver({ animate: false });
      d.highlight({ element: "#intro", popover: { title: "Hi", action: "Click it." } });
      await nextFrame();

      expect(actionText()).toBe("Click it.");
      expect(footer()?.style.display).toBe("none");
    });

    it("describes the dialog with the instruction", async () => {
      const d = await start({ steps: withFirst(actionStep()) });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe(
        "driver-popover-description driver-popover-action-text"
      );

      d.moveNext();
      await nextFrame();
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe("driver-popover-description");
    });

    it("does not create the action nodes for other popovers", async () => {
      const d = await start({ steps: SAMPLE_STEPS });

      expect(actionRow()).toBeNull();
      expect(status()).toBeNull();
      expect(d.getState("popover").action).toBeUndefined();
      expect(navButton("next")?.style.display).toBe("block");
    });

    it("exposes the nodes on PopoverDOM", async () => {
      const onPopoverRender = vi.fn();
      await start({ onPopoverRender, steps: withFirst(actionStep()) });

      const popover = onPopoverRender.mock.calls[0][0];
      expect(popover.action).toBe(actionRow());
      expect(popover.actionStatus).toBe(status());
    });

    it("survives an onPopoverRender that removes the footer", async () => {
      const d = await start({
        steps: SAMPLE_STEPS,
        onPopoverRender: popover => popover.footer.remove(),
      });

      expect(() => d.updatePopover({ action: "Click Intro." })).not.toThrow();
      expect(actionText()).toBe("Click Intro.");
    });
  });

  describe("moving on", () => {
    it("advances immediately through advanceOn", async () => {
      const d = await start({ steps: withFirst(actionStep({ advanceOn: "click" })) });

      click("#intro");
      expect(d.getActiveIndex()).toBe(1);
      expect(popoverTitle()).toBe("Step 2");
    });

    it("advances when the app calls moveNext()", async () => {
      const d = await start({
        steps: withFirst(
          actionStep({
            onHighlighted: (element, step, { signal, driver }) => {
              window.addEventListener("saved", () => driver.moveNext(), { signal });
            },
          })
        ),
      });

      window.dispatchEvent(new Event("saved"));
      expect(d.getActiveIndex()).toBe(1);
    });

    it("ignores ArrowRight", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      pressKey("ArrowRight");
      await nextFrame();
      expect(d.getActiveIndex()).toBe(0);
    });

    it("ignores an overlay click with overlayClickBehavior nextStep", async () => {
      const onNextClick = vi.fn();
      const d = await start({ overlayClickBehavior: "nextStep", onNextClick, steps: withFirst(actionStep()) });

      clickOverlay();
      expect(onNextClick).not.toHaveBeenCalled();
      expect(d.getActiveIndex()).toBe(0);
    });

    it("still moves on through the overlay on other steps", async () => {
      const d = await start(
        { overlayClickBehavior: "nextStep", steps: [actionStep(), SAMPLE_STEPS[1], SAMPLE_STEPS[2]] },
        1
      );

      clickOverlay();
      expect(d.getActiveIndex()).toBe(2);
    });

    it("keeps ArrowLeft, previous and close", async () => {
      const d = await start({ steps: [SAMPLE_STEPS[0], actionStep({ element: "#card-1" })] }, 1);

      pressKey("ArrowLeft");
      await nextFrame();
      expect(d.getActiveIndex()).toBe(0);

      d.moveNext();
      await nextFrame();
      navButton("prev")!.click();
      expect(d.getActiveIndex()).toBe(0);

      d.moveNext();
      await nextFrame();
      navButton("close")!.click();
      expect(d.isActive()).toBe(false);
    });
  });

  describe("patching", () => {
    it("changes the instruction with updatePopover and announces it", async () => {
      const d = await start({ steps: withFirst(actionStep()) });
      const wrapper = popoverEl();

      d.updatePopover({ action: "Not that one. Click <b>Intro</b>." });

      expect(popoverEl()).toBe(wrapper);
      expect(actionText()).toBe("Not that one. Click Intro.");
      expect(liveRegion()?.textContent).toBe("Not that one. Click Intro.");
    });

    it("changes the instruction with nudge", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.nudge({ action: "Click Intro, up there." });

      expect(actionText()).toBe("Click Intro, up there.");
      expect(popoverEl()?.classList.contains("driver-popover-nudge")).toBe(true);
    });

    it("changes the status text", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.updatePopover({ actionStatusText: "Saving..." });
      expect(status()?.textContent).toBe("Saving...");
    });

    it("restores the step's instruction when called without a patch", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.updatePopover({ action: "Changed" });
      d.updatePopover();

      expect(actionText()).toBe("Click Intro to go on.");
    });

    it("turns a read step into an action step and back", async () => {
      const d = await start({ steps: SAMPLE_STEPS });

      d.updatePopover({ action: "Now click Intro." });
      expect(actionText()).toBe("Now click Intro.");
      expect(navButton("next")?.style.display).toBe("none");
      expect(status()?.style.display).toBe("inline-block");
      pressKey("ArrowRight");
      await nextFrame();
      expect(d.getActiveIndex()).toBe(0);

      d.updatePopover();
      expect(actionRow()?.style.display).toBe("none");
      expect(status()?.style.display).toBe("none");
      expect(navButton("next")?.style.display).toBe("block");
      expect(isActionPopover()).toBe(false);
      pressKey("ArrowRight");
      await nextFrame();
      expect(d.getActiveIndex()).toBe(1);
    });
  });

  describe("accessibility references", () => {
    const addHelp = (popover: PopoverDOM) => {
      const ids = popover.wrapper.getAttribute("aria-describedby");
      popover.wrapper.setAttribute("aria-describedby", `${ids} my-help`);
    };

    it("keeps ids added in onPopoverRender on ordinary steps", async () => {
      const d = await start({ onPopoverRender: addHelp, steps: SAMPLE_STEPS });

      d.updatePopover({ title: "Changed" });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe("driver-popover-description my-help");
    });

    it("only adds and removes its own id on action steps", async () => {
      const d = await start({ onPopoverRender: addHelp, steps: withFirst(actionStep()) });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe(
        "driver-popover-description driver-popover-action-text my-help"
      );

      d.updatePopover({ action: "" });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe("driver-popover-description my-help");

      d.updatePopover({ action: "Again." });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe(
        "driver-popover-description my-help driver-popover-action-text"
      );
    });
  });

  describe("while animating", () => {
    it("ignores an overlay click on an action step that is still animating in", async () => {
      const d = createDriver({ overlayClickBehavior: "nextStep", duration: 1000, steps: withFirst(actionStep()) });
      d.drive();
      await nextFrame();

      expect(d.getState("__transitionCallback")).toBeDefined();
      expect(document.querySelector(".driver-overlay path")).not.toBeNull();
      clickOverlay();
      expect(d.getActiveIndex()).toBe(0);
    });

    it("ignores an overlay click during a transition from a read step to an action step", async () => {
      const d = createDriver({
        overlayClickBehavior: "nextStep",
        duration: 50,
        steps: [SAMPLE_STEPS[0], actionStep({ element: "#card-1" }), SAMPLE_STEPS[2]],
      });
      d.drive();
      await tick(150);

      d.moveNext();
      expect(d.getState("__transitionCallback")).toBeDefined();
      clickOverlay();
      expect(d.getActiveIndex()).toBe(1);

      await tick(150);
      clickOverlay();
      expect(d.getActiveIndex()).toBe(1);
    });
  });

  describe("success recipe", () => {
    // Mirrors the "Show Success Before Moving On" recipe in the docs.
    function successStep(): DriveStep {
      let timer: ReturnType<typeof setTimeout> | undefined;

      return {
        element: "#card-1",
        advanceOn: "click",
        onDeselected: () => {
          clearTimeout(timer);
          timer = undefined;
        },
        popover: {
          title: "Act",
          action: "Click Card One.",
          onNextClick: (element, step, { driver }) => {
            if (timer) {
              return;
            }

            driver.updatePopover({ actionStatusText: "Opened", popoverClass: "is-done" });
            timer = setTimeout(() => {
              timer = undefined;
              driver.moveNext();
            }, 600);
          },
        },
      };
    }

    function appStep(): DriveStep {
      return {
        element: "#card-1",
        onHighlighted: (element, step, { signal, driver }) => {
          const onSaved = () => {
            driver.updatePopover({ actionStatusText: "Saved" });
            const timer = setTimeout(() => driver.moveNext(), 600);
            signal?.addEventListener("abort", () => clearTimeout(timer));
          };

          window.addEventListener("saved", onSaved, { signal, once: true });
        },
        popover: { title: "Save", action: "Click Save." },
      };
    }

    // Only timeouts are faked; highlighting still needs real animation frames.
    async function withFakeTimers(run: () => Promise<void>) {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        await run();
      } finally {
        vi.useRealTimers();
      }
    }

    it("shows success, then moves on once", () =>
      withFakeTimers(async () => {
        const d = createDriver({ animate: false, steps: [SAMPLE_STEPS[0], successStep(), SAMPLE_STEPS[2]] });
        d.drive(1);
        await nextFrame();

        click("#card-1");
        expect(d.getActiveIndex()).toBe(1);
        expect(status()?.textContent).toBe("Opened");
        expect(popoverEl()?.classList.contains("is-done")).toBe(true);

        click("#card-1");
        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);

        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);
      }));

    it("does not move a later visit of the same step on", () =>
      withFakeTimers(async () => {
        const d = createDriver({ animate: false, steps: [SAMPLE_STEPS[0], successStep(), SAMPLE_STEPS[2]] });
        d.drive(1);
        await nextFrame();

        click("#card-1");
        d.movePrevious();
        await nextFrame();
        d.moveNext();
        await nextFrame();
        expect(status()?.textContent).toBe("Waiting for you");

        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(1);
      }));

    it("does nothing after destroy", () =>
      withFakeTimers(async () => {
        const d = createDriver({ animate: false, steps: [SAMPLE_STEPS[0], successStep(), SAMPLE_STEPS[2]] });
        d.drive(1);
        await nextFrame();

        click("#card-1");
        d.destroy();
        vi.advanceTimersByTime(600);
        expect(d.isActive()).toBe(false);
      }));

    it("works the same for steps the app completes with moveNext()", () =>
      withFakeTimers(async () => {
        const d = createDriver({ animate: false, steps: [SAMPLE_STEPS[0], appStep(), SAMPLE_STEPS[2]] });
        d.drive(1);
        await nextFrame();

        window.dispatchEvent(new Event("saved"));
        expect(status()?.textContent).toBe("Saved");

        d.movePrevious();
        await nextFrame();
        d.moveNext();
        await nextFrame();
        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(1);

        window.dispatchEvent(new Event("saved"));
        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);
      }));
  });

  describe("backward compatibility", () => {
    it("leaves advanceOn steps without an action as they were", async () => {
      const d = await start({ steps: withFirst({ ...SAMPLE_STEPS[0], advanceOn: "click" }) });

      expect(navButton("next")?.style.display).toBe("block");
      expect(actionRow()).toBeNull();

      pressKey("ArrowRight");
      await nextFrame();
      expect(d.getActiveIndex()).toBe(1);
    });
  });
});

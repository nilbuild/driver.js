import { describe, expect, it, vi } from "vitest";
import type { DriveStep, PopoverDOM } from "../../src/driver";
import { createDriver, navButton, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

const row = () => document.querySelector<HTMLElement>(".driver-popover-instruction");
const rowText = () => document.querySelector<HTMLElement>(".driver-popover-instruction-text");
const indicator = () => document.querySelector<HTMLElement>(".driver-popover-instruction-indicator");
const footer = () => document.querySelector<HTMLElement>(".driver-popover-footer");
const next = () => navButton("next")!;
const hasClass = (name: string) => !!popoverEl()?.classList.contains(name);
const isGated = () => hasClass("driver-popover-has-instruction");
const isDone = () => hasClass("driver-popover-instruction-done");
const isNudged = () => hasClass("driver-popover-nudge");
const liveRegion = () => document.querySelector(".driver-live-region");

const actionStep = (extra: Partial<DriveStep> = {}, popover: DriveStep["popover"] = {}): DriveStep => ({
  ...SAMPLE_STEPS[0],
  ...extra,
  popover: { ...SAMPLE_STEPS[0].popover, instruction: "Click <b>Intro</b> to go on.", ...popover },
});

const withFirst = (step: DriveStep) => [step, ...SAMPLE_STEPS.slice(1)];

async function start(config: Parameters<typeof createDriver>[0], index = 0) {
  const d = createDriver({ animate: false, ...config });
  d.drive(index);
  await nextFrame();
  return d;
}

describe("popover.instruction", () => {
  describe("rendering", () => {
    it("shows the instruction in its own row between the description and the footer", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(row()?.style.display).toBe("flex");
      expect(rowText()?.querySelector("b")?.textContent).toBe("Intro");
      expect(row()?.textContent).toBe("Click Intro to go on.");
      expect(row()?.previousElementSibling?.classList.contains("driver-popover-description")).toBe(true);
      expect(row()?.nextElementSibling).toBe(footer());
      expect(isGated()).toBe(true);
    });

    it("ends the row with a decorative indicator", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(Array.from(row()!.children).map(child => child.className)).toEqual([
        "driver-popover-instruction-text",
        "driver-popover-instruction-indicator",
      ]);
      expect(indicator()?.getAttribute("aria-hidden")).toBe("true");
      expect(indicator()?.textContent).toBe("");
      expect(indicator()?.style.display).toBe("");
    });

    it("keeps Next in its place, looking disabled but still focusable", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(next().style.display).toBe("block");
      expect(next().getAttribute("aria-disabled")).toBe("true");
      expect(next().disabled).toBe(false);
      expect(next().classList.contains("driver-popover-btn-disabled")).toBe(true);
      expect(next().textContent).toBe("Next");
      expect(document.querySelector(".driver-popover-action-status")).toBeNull();
    });

    it("shows the done text on the disabled Next of the last step", async () => {
      await start({ doneBtnText: "Finish", steps: [SAMPLE_STEPS[1], actionStep()] }, 1);

      expect(next().textContent).toBe("Finish");
      expect(next().getAttribute("aria-disabled")).toBe("true");
    });

    it("renders nothing extra without a next button, and the footer collapses", async () => {
      await start({ showButtons: ["close"], steps: withFirst(actionStep()) });

      expect(next().style.display).toBe("none");
      expect(footer()?.style.display).toBe("none");
      expect(row()?.style.display).toBe("flex");
      expect(indicator()?.style.display).toBe("");
    });

    it("keeps the footer for Previous or the progress text", async () => {
      await start({ showButtons: ["previous"], steps: withFirst(actionStep()) });
      expect(footer()?.style.display).toBe("flex");
    });

    it("works without advanceOn", async () => {
      await start({ steps: withFirst(actionStep()) });

      expect(row()?.style.display).toBe("flex");
      expect(isGated()).toBe(true);
    });

    it("is a plain line on a single highlight: no indicator, nothing gated", async () => {
      const d = createDriver({ animate: false });
      d.highlight({
        element: "#intro",
        popover: { title: "Hi", instruction: "Click it.", showButtons: ["next"], onNextClick: () => d.destroy() },
      });
      await nextFrame();

      expect(row()?.textContent).toBe("Click it.");
      expect(indicator()?.style.display).toBe("none");
      expect(isGated()).toBe(false);
      expect(next().hasAttribute("aria-disabled")).toBe(false);

      next().click();
      expect(d.isActive()).toBe(false);
    });

    it("describes the dialog with the instruction", async () => {
      const d = await start({ steps: withFirst(actionStep()) });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe(
        "driver-popover-description driver-popover-instruction-text"
      );
      expect(rowText()?.id).toBe("driver-popover-instruction-text");

      d.moveNext();
      await nextFrame();
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe("driver-popover-description");
    });

    it("does not create the instruction nodes for other popovers", async () => {
      const d = await start({ steps: SAMPLE_STEPS });

      expect(row()).toBeNull();
      expect(d.getState("popover").instruction).toBeUndefined();
      expect(next().hasAttribute("aria-disabled")).toBe(false);
    });

    it("exposes the row and the indicator on PopoverDOM", async () => {
      const onPopoverRender = vi.fn();
      await start({ onPopoverRender, steps: withFirst(actionStep()) });

      const popover: PopoverDOM = onPopoverRender.mock.calls[0][0];
      expect(popover.instruction).toBe(row());
      expect(popover.instructionIndicator).toBe(indicator());
    });

    it("leaves a row replaced in onPopoverRender alone", async () => {
      const d = await start({
        steps: withFirst(actionStep()),
        onPopoverRender: popover => {
          popover.instruction!.innerHTML = `<em class="mine">Do it</em>`;
        },
      });

      d.updatePopover({ instruction: "Changed" });

      expect(row()?.innerHTML).toBe(`<em class="mine">Do it</em>`);
    });

    it("survives an onPopoverRender that removes the footer", async () => {
      const d = await start({
        steps: withFirst(actionStep()),
        onPopoverRender: popover => popover.footer.remove(),
      });

      expect(row()?.parentElement).toBe(popoverEl());
      expect(() => d.updatePopover({ instruction: "Still here" })).not.toThrow();
      expect(row()?.textContent).toBe("Still here");
    });
  });

  describe("asking for Next by hand", () => {
    it("nudges instead of advancing when Next is clicked, and skips onNextClick", async () => {
      const onNextClick = vi.fn();
      const d = await start({ onNextClick, steps: withFirst(actionStep()) });

      next().click();

      expect(d.getActiveIndex()).toBe(0);
      expect(isNudged()).toBe(true);
      expect(onNextClick).not.toHaveBeenCalled();
    });
  });

  describe("moving on", () => {
    it("advances when the app calls moveNext()", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.moveNext();
      expect(d.getActiveIndex()).toBe(1);
    });

    it("advance() completes right away without a delay and goes through onNextClick", async () => {
      const onNextClick = vi.fn();
      const d = await start({ onNextClick, steps: withFirst(actionStep()) });

      d.advance();

      expect(onNextClick).toHaveBeenCalledTimes(1);
      expect(d.getActiveIndex()).toBe(0);
    });
  });

  describe("patching", () => {
    it("changes the instruction with updatePopover and announces it", async () => {
      const d = await start({ steps: withFirst(actionStep()) });
      const wrapper = popoverEl();

      d.updatePopover({ instruction: "Not that one. Click <b>Intro</b>." });

      expect(popoverEl()).toBe(wrapper);
      expect(row()?.textContent).toBe("Not that one. Click Intro.");
      expect(liveRegion()?.textContent).toBe("Not that one. Click Intro.");
    });

    it("changes the instruction with nudge", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.nudge({ instruction: "Click Intro, up there." });

      expect(row()?.textContent).toBe("Click Intro, up there.");
      expect(isNudged()).toBe(true);
    });

    it("restores the step's instruction when called without a patch", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.updatePopover({ instruction: "Changed" });
      d.updatePopover();

      expect(row()?.textContent).toBe("Click Intro to go on.");
    });

    it("doesn't turn a read step into an action step", async () => {
      const d = await start({ steps: SAMPLE_STEPS });

      d.updatePopover({ instruction: "Now click Intro." });
      expect(row()).toBeNull();
      expect(isGated()).toBe(false);

      next().click();
      expect(d.getActiveIndex()).toBe(1);
    });

    it("keeps an action step an action step when the instruction is cleared", async () => {
      const d = await start({ steps: withFirst(actionStep()) });

      d.updatePopover({ instruction: "" });
      expect(row()?.style.display).toBe("none");
      expect(next().getAttribute("aria-disabled")).toBe("true");
      expect(isGated()).toBe(true);

      next().click();
      expect(d.getActiveIndex()).toBe(0);
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
        "driver-popover-description driver-popover-instruction-text my-help"
      );

      d.updatePopover({ instruction: "" });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe("driver-popover-description my-help");

      d.updatePopover({ instruction: "Again." });
      expect(popoverEl()?.getAttribute("aria-describedby")).toBe(
        "driver-popover-description my-help driver-popover-instruction-text"
      );
    });
  });

  describe("advanceDelay", () => {
    async function withFakeTimers(run: () => Promise<void>) {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      try {
        await run();
      } finally {
        vi.useRealTimers();
      }
    }

    const doneStep = (extra: Partial<DriveStep> = {}, popover: DriveStep["popover"] = {}) =>
      actionStep({ element: "#card-1", advanceDelay: 600, ...extra }, popover);

    async function startAt(config: Parameters<typeof createDriver>[0]) {
      const d = createDriver({ animate: false, ...config });
      d.drive(1);
      await nextFrame();
      return d;
    }

    const steps = () => [SAMPLE_STEPS[0], doneStep(), SAMPLE_STEPS[2]];

    it("shows the done state, then moves on once", () =>
      withFakeTimers(async () => {
        const d = await startAt({ steps: steps() });
        expect(isDone()).toBe(false);

        d.advance();
        expect(d.getActiveIndex()).toBe(1);
        expect(isDone()).toBe(true);
        expect(row()?.style.display).toBe("flex");
        expect(indicator()?.style.display).toBe("");
        expect(next().getAttribute("aria-disabled")).toBe("true");

        d.advance();
        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);

        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);
      }));

    it("announces completion once, with the done button text", () =>
      withFakeTimers(async () => {
        const d = await startAt({ doneBtnText: "All done", steps: steps() });

        d.advance();
        expect(liveRegion()?.textContent).toBe("All done");
      }));

    it("takes the delay from the config", () =>
      withFakeTimers(async () => {
        const d = await startAt({
          advanceDelay: 300,
          steps: [SAMPLE_STEPS[0], doneStep({ advanceDelay: undefined }), SAMPLE_STEPS[2]],
        });

        d.advance();
        expect(isDone()).toBe(true);
        vi.advanceTimersByTime(300);
        expect(d.getActiveIndex()).toBe(2);
      }));

    it("does not move a later visit of the same step on", () =>
      withFakeTimers(async () => {
        const d = await startAt({ steps: steps() });

        d.advance();
        d.movePrevious();
        await nextFrame();
        d.moveNext();
        await nextFrame();
        expect(isDone()).toBe(false);

        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(1);
      }));

    it("does nothing after destroy", () =>
      withFakeTimers(async () => {
        const d = await startAt({ steps: steps() });

        d.advance();
        d.destroy();
        vi.advanceTimersByTime(600);
        expect(d.isActive()).toBe(false);
      }));

    it("keeps moveNext() immediate", () =>
      withFakeTimers(async () => {
        const d = await startAt({ steps: steps() });

        d.moveNext();
        expect(d.getActiveIndex()).toBe(2);
      }));

    it("pauses on a read step too, without any done styling", () =>
      withFakeTimers(async () => {
        const d = await startAt({
          steps: [SAMPLE_STEPS[0], { ...SAMPLE_STEPS[1], advanceDelay: 600 }, SAMPLE_STEPS[2]],
        });

        d.advance();
        expect(d.getActiveIndex()).toBe(1);
        expect(isDone()).toBe(false);
        expect(liveRegion()?.textContent).toBe("");

        vi.advanceTimersByTime(600);
        expect(d.getActiveIndex()).toBe(2);
      }));
  });

  describe("removed options", () => {
    it("ignores the old action, actionStatusText and actionDoneText", async () => {
      const popover = { title: "Old", action: "Do it", actionStatusText: "Waiting", actionDoneText: "Done" };
      const d = await start({ steps: [{ element: "#intro", popover } as DriveStep, SAMPLE_STEPS[1]] });

      expect(row()).toBeNull();
      expect(isGated()).toBe(false);
      next().click();
      expect(d.getActiveIndex()).toBe(1);
    });
  });
});

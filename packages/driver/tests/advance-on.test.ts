import { describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

function fire(selector: string, type: string, init: MouseEventInit = {}): boolean {
  const element = document.querySelector(selector);
  if (!element) {
    throw new Error(`No element for ${selector}`);
  }

  return element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, ...init }));
}

function key(selector: string, init: KeyboardEventInit): void {
  document.querySelector(selector)?.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, ...init }));
}

const withStep = (index: number, extra: object) =>
  SAMPLE_STEPS.map((step, i) => (i === index ? { ...step, ...extra } : step));

describe("advanceOn", () => {
  describe("event name", () => {
    it("advances when the named event fires on the highlighted element", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
      expect(popoverTitle()).toBe("Step 2");
    });

    it("ignores other events on the highlighted element", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#intro", "click");
      fire("#intro", "dblclick");
      expect(d.getActiveIndex()).toBe(0);
    });

    it("ignores the event outside the highlighted element", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#card-1", "contextmenu");
      expect(d.getActiveIndex()).toBe(0);
    });

    it("advances on events fired by a descendant of the highlighted element", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { element: ".page-header", advanceOn: "dblclick" }) });
      d.drive();
      await nextFrame();

      fire(".page-header h1", "dblclick");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("accepts a list of events", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: ["dblclick", "contextmenu"] }) });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("can be set for every step in the config", async () => {
      const d = createDriver({ animate: false, advanceOn: "dblclick", steps: SAMPLE_STEPS });
      d.drive();
      await nextFrame();

      fire("#intro", "dblclick");
      expect(d.getActiveIndex()).toBe(1);

      fire("#card-1", "dblclick");
      expect(d.getActiveIndex()).toBe(2);
    });

    it("prefers the step value over the config value", async () => {
      const d = createDriver({
        animate: false,
        advanceOn: "dblclick",
        steps: withStep(0, { advanceOn: "contextmenu" }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "dblclick");
      expect(d.getActiveIndex()).toBe(0);

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("stops listening once the step is left", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();
      d.moveTo(1);
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("stops listening after destroy", async () => {
      const onNextClick = vi.fn();
      const d = createDriver({ animate: false, onNextClick, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();
      d.destroy();

      fire("#intro", "contextmenu");
      expect(onNextClick).not.toHaveBeenCalled();
    });

    it("does not prevent the app's own handling of the event", async () => {
      const appHandler = vi.fn();
      document.querySelector("#intro")?.addEventListener("contextmenu", appHandler);

      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      expect(fire("#intro", "contextmenu")).toBe(true);
      expect(appHandler).toHaveBeenCalledTimes(1);
    });

    it("goes through onNextClick like the next button", async () => {
      const onNextClick = vi.fn();
      const d = createDriver({ animate: false, onNextClick, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(onNextClick).toHaveBeenCalledTimes(1);
      expect(d.getActiveIndex()).toBe(0);
    });

    it("ends the tour with reason done on the last step", async () => {
      const onDestroyed = vi.fn();
      const d = createDriver({ animate: false, onDestroyed, steps: withStep(2, { advanceOn: "contextmenu" }) });
      d.drive(2);
      await nextFrame();

      fire(".feature-list", "contextmenu");
      expect(d.isActive()).toBe(false);
      expect(onDestroyed.mock.calls[0][2].reason).toBe("done");
    });
  });

  describe("function", () => {
    it("covers a key check by listening with the signal", async () => {
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          element: "#card-1",
          advanceOn: (el: Element, _step: unknown, opts: { next: () => void; signal: AbortSignal }) => {
            el.addEventListener(
              "keydown",
              e => {
                if ((e as KeyboardEvent).key === "Enter") {
                  opts.next();
                }
              },
              { signal: opts.signal }
            );
          },
        }),
      });
      d.drive();
      await nextFrame();

      key("#card-1", { key: "a" });
      expect(d.getActiveIndex()).toBe(0);

      key("#card-1", { key: "Enter" });
      expect(d.getActiveIndex()).toBe(1);
    });

    it("covers a target outside the highlighted element", async () => {
      const menu = document.createElement("button");
      menu.className = "menu-item";
      document.body.appendChild(menu);

      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { next: () => void; signal: AbortSignal }) => {
            document.addEventListener(
              "click",
              e => {
                if ((e.target as Element).closest(".menu-item")) {
                  opts.next();
                }
              },
              { signal: opts.signal }
            );
          },
        }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "click");
      expect(d.getActiveIndex()).toBe(0);

      fire(".menu-item", "click");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("advances when the function calls next", async () => {
      let next: (() => void) | undefined;
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { next: () => void }) => {
            next = opts.next;
          },
        }),
      });
      d.drive();
      await nextFrame();

      expect(d.getActiveIndex()).toBe(0);
      next?.();
      expect(d.getActiveIndex()).toBe(1);
    });

    it("receives the element, step and hook options", async () => {
      const advanceOn = vi.fn();
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn }) });
      d.drive();
      await nextFrame();

      expect(advanceOn).toHaveBeenCalledTimes(1);
      const [element, step, opts] = advanceOn.mock.calls[0];
      expect(element).toBe(document.querySelector("#intro"));
      expect(step.popover.title).toBe("Step 1");
      expect(opts.driver).toBe(d);
      expect(opts.index).toBe(0);
      expect(opts.signal).toBeInstanceOf(AbortSignal);
    });

    it("aborts the signal and ignores next once the step is left", async () => {
      let captured: { next: () => void; signal: AbortSignal } | undefined;
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { next: () => void; signal: AbortSignal }) => {
            captured = opts;
          },
        }),
      });
      d.drive();
      await nextFrame();

      expect(captured?.signal.aborted).toBe(false);
      d.moveTo(2);
      await nextFrame();
      expect(captured?.signal.aborted).toBe(true);

      captured?.next();
      expect(d.getActiveIndex()).toBe(2);
    });

    it("aborts the signal on destroy", async () => {
      let signal: AbortSignal | undefined;
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { signal: AbortSignal }) => {
            signal = opts.signal;
          },
        }),
      });
      d.drive();
      await nextFrame();
      d.destroy();

      expect(signal?.aborted).toBe(true);
    });
  });

  describe("advanceOnClick compatibility", () => {
    it("still advances on click", async () => {
      const d = createDriver({ animate: false, advanceOnClick: true, steps: SAMPLE_STEPS });
      d.drive();
      await nextFrame();

      fire("#intro", "click");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("lets a step advanceOn take over from a config advanceOnClick", async () => {
      const d = createDriver({
        animate: false,
        advanceOnClick: true,
        steps: withStep(0, { advanceOn: "contextmenu" }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "click");
      expect(d.getActiveIndex()).toBe(0);

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("does not double-advance when advanceOn is click and advanceOnClick is on", async () => {
      const d = createDriver({
        animate: false,
        advanceOnClick: true,
        steps: withStep(0, { advanceOn: "click" }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "click");
      expect(d.getActiveIndex()).toBe(1);
    });
  });

  describe("lifecycle", () => {
    it("lets false switch off an inherited config value", async () => {
      const d = createDriver({ animate: false, advanceOn: "dblclick", steps: withStep(0, { advanceOn: false }) });
      d.drive();
      await nextFrame();

      fire("#intro", "dblclick");
      expect(d.getActiveIndex()).toBe(0);
    });

    it("still completes when the app stops propagation", async () => {
      document.querySelector("#intro")?.addEventListener("contextmenu", e => e.stopPropagation());

      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(0);

      await new Promise(resolve => setTimeout(resolve, 0));
      expect(d.getActiveIndex()).toBe(1);
    });

    it("drops a deferred completion when the app navigates in its own handler", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: "contextmenu" }) });
      document.querySelector("#intro")?.addEventListener("contextmenu", e => {
        e.stopPropagation();
        d.moveTo(2);
      });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      await new Promise(resolve => setTimeout(resolve, 0));
      expect(d.getActiveIndex()).toBe(2);
    });

    it("completes during the highlight transition", () => {
      const d = createDriver({ animate: true, steps: withStep(1, { advanceOn: "contextmenu" }) });
      d.drive();
      d.moveNext();

      fire("#card-1", "contextmenu");
      expect(d.getActiveIndex()).toBe(2);
    });

    it("ignores repeated completions while the next step is waiting for its element", async () => {
      const onHighlighted = vi.fn();
      const d = createDriver({
        animate: false,
        steps: [
          { element: "#intro", advanceOn: "contextmenu" },
          { element: "#late", waitForElement: 1000, onHighlighted },
          SAMPLE_STEPS[2],
        ],
      });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      fire("#intro", "contextmenu");
      fire("#intro", "contextmenu");

      const late = document.createElement("div");
      late.id = "late";
      document.body.appendChild(late);
      await nextFrame();
      await nextFrame();

      expect(d.getActiveIndex()).toBe(1);
      expect(onHighlighted).toHaveBeenCalledTimes(1);
    });

    it("re-arms when onNextClick keeps the step", async () => {
      const onNextClick = vi.fn();
      const d = createDriver({ animate: false, onNextClick, steps: withStep(0, { advanceOn: "contextmenu" }) });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      fire("#intro", "contextmenu");
      expect(onNextClick).toHaveBeenCalledTimes(2);
    });

    it("runs a returned cleanup when the step is left", async () => {
      const cleanup = vi.fn();
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: () => cleanup }) });
      d.drive();
      await nextFrame();
      expect(cleanup).not.toHaveBeenCalled();

      d.moveNext();
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("runs the cleanup straight away when next is called synchronously", async () => {
      const cleanup = vi.fn();
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { next: () => void }) => {
            opts.next();
            return cleanup;
          },
        }),
      });
      d.drive();

      expect(d.getActiveIndex()).toBe(1);
      expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it("aborts the signal when setSteps replaces the steps", async () => {
      let signal: AbortSignal | undefined;
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: (_el: Element, _step: unknown, opts: { signal: AbortSignal }) => {
            signal = opts.signal;
          },
        }),
      });
      d.drive();
      d.setSteps(SAMPLE_STEPS);

      expect(signal?.aborted).toBe(true);
    });

    it("works with highlight()", async () => {
      const onNextClick = vi.fn();
      const d = createDriver({ animate: false, onNextClick });
      d.highlight({ element: "#intro", advanceOn: "contextmenu", popover: { title: "Hi" } });
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(onNextClick).toHaveBeenCalledTimes(1);
    });
  });
});

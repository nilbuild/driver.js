import { describe, expect, it, vi } from "vitest";
import { append, createDriver, keyEvent, nextFrame, popoverTitle, SAMPLE_STEPS, useDriverHarness } from "./utils";

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
      const d = createDriver({
        animate: false,
        steps: withStep(0, { element: ".page-header", advanceOn: "dblclick" }),
      });
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

  describe("event with a condition", () => {
    function addInput() {
      const input = document.createElement("input");
      document.querySelector("#intro")?.appendChild(input);
      return input;
    }

    it("advances only when the condition holds", async () => {
      const input = addInput();
      const d = createDriver({
        animate: false,
        steps: withStep(0, {
          advanceOn: {
            event: "change",
            when: (el: Element) => (el.querySelector("input") as HTMLInputElement).value === "yes",
          },
        }),
      });
      d.drive();
      await nextFrame();

      input.value = "no";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(d.getActiveIndex()).toBe(0);

      input.value = "yes";
      input.dispatchEvent(new Event("change", { bubbles: true }));
      expect(d.getActiveIndex()).toBe(1);
    });

    it("advances on the event when no condition is given", async () => {
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: { event: "dblclick" } }) });
      d.drive();
      await nextFrame();

      fire("#intro", "dblclick");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("accepts a list of events", async () => {
      const when = vi.fn(() => true);
      const d = createDriver({
        animate: false,
        steps: withStep(0, { advanceOn: { event: ["dblclick", "contextmenu"], when } }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "contextmenu");
      expect(d.getActiveIndex()).toBe(1);
    });

    it("passes the element, step and options with the event", async () => {
      const when = vi.fn(() => false);
      const d = createDriver({ animate: false, steps: withStep(0, { advanceOn: { event: "click", when } }) });
      d.drive();
      await nextFrame();

      fire("#intro", "click");

      expect(when).toHaveBeenCalledTimes(1);
      const [element, step, opts] = when.mock.calls[0] as unknown as [
        Element,
        { popover: { title: string } },
        { event: Event; driver: unknown; index: number },
      ];
      expect(element).toBe(document.querySelector("#intro"));
      expect(step.popover.title).toBe("Step 1");
      expect(opts.event.type).toBe("click");
      expect(opts.driver).toBe(d);
      expect(opts.index).toBe(0);
    });

    it("checks the condition after the app's own handlers", async () => {
      const input = addInput();
      input.addEventListener("keydown", () => {
        input.dataset.handled = "true";
      });
      const d = createDriver({
        animate: false,
        steps: withStep(0, { advanceOn: { event: "keydown", when: () => input.dataset.handled === "true" } }),
      });
      d.drive();
      await nextFrame();

      keyEvent("keydown", { key: "Enter", code: "Enter" }, input);
      expect(d.getActiveIndex()).toBe(1);
    });

    it("does not check an event blocked by onInteraction", async () => {
      const when = vi.fn(() => true);
      const d = createDriver({
        animate: false,
        onInteraction: () => false,
        steps: withStep(0, { advanceOn: { event: "click", when } }),
      });
      d.drive();
      await nextFrame();

      fire("#intro", "click");

      expect(when).not.toHaveBeenCalled();
      expect(d.getActiveIndex()).toBe(0);
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

describe("advanceOn on re-rendered elements", () => {
  it("follows a re-rendered element", async () => {
    const input = append("field", "input");
    const d = createDriver({
      animate: false,
      onElementMissing: vi.fn(),
      steps: [
        {
          element: "#field",
          advanceOn: { event: "keydown", when: (_el, _step, opts) => (opts.event as KeyboardEvent).key === "Enter" },
        },
        SAMPLE_STEPS[1],
      ],
    });
    d.drive();
    await nextFrame();

    input.remove();
    const replacement = append("field", "input");
    await nextFrame();
    await nextFrame();

    keyEvent("keydown", { key: "Enter", code: "Enter" }, replacement);
    expect(d.getActiveIndex()).toBe(1);
  });
});

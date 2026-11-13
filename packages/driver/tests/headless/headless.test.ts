import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type Config, type Driver, type DriverHook, type DriveStep } from "../../src/headless";
import { driver as fullDriver } from "../../src/driver";
import { append, DEMO_HTML, nextFrame, pressKey, SAMPLE_STEPS, tick } from "../utils";

let active: Driver | undefined;

function createHeadless(config?: Config): Driver {
  active = driver(config);
  return active;
}

beforeEach(() => {
  document.body.innerHTML = DEMO_HTML;
});

afterEach(() => {
  active?.destroy();
  active = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

const snapshot = () => document.documentElement.outerHTML;
const click = (selector: string) =>
  document.querySelector(selector)!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

describe("headless", () => {
  it("changes nothing on the page, whatever the config asks for", async () => {
    const before = snapshot();
    const d = createHeadless({
      allowScroll: false,
      disableActiveInteraction: true,
      allowedElements: "#card-1",
      steps: [...SAMPLE_STEPS, { popover: { title: "No element" } }],
    });

    d.drive();
    await nextFrame();
    expect(snapshot()).toBe(before);

    d.moveNext();
    await nextFrame();
    d.moveTo(3);
    await nextFrame();
    expect(snapshot()).toBe(before);

    d.destroy();
    expect(snapshot()).toBe(before);
  });

  it("never scrolls the target into view", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue(new DOMRect(0, 5000, 100, 20));

    const d = createHeadless({ steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();

    expect(scroll).not.toHaveBeenCalled();
  });

  it("tracks the active step and element", async () => {
    const d = createHeadless({ steps: [...SAMPLE_STEPS, { popover: { title: "No element" } }] });
    d.drive();
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));

    d.moveNext();
    await nextFrame();
    expect(d.getActiveElement()).toBe(document.querySelector("#card-1"));
    expect(d.getPreviousElement()).toBe(document.querySelector("#intro"));

    d.moveTo(3);
    await nextFrame();
    expect(d.getActiveStep()?.popover?.title).toBe("No element");
    expect(d.getActiveElement()).toBeUndefined();

    d.moveNext();
    expect(d.isActive()).toBe(false);
  });

  it("runs the hooks exactly like the full driver", async () => {
    const run = async (create: (config: Config) => Driver) => {
      const trace: string[] = [];
      const hook =
        (name: string): DriverHook =>
        (element, step, opts) => {
          const id = element ? element.id : "none";
          trace.push(`${name}:${step.popover?.title}:${id}${opts.reason ? ` (${opts.reason})` : ""}`);
        };
      const d = create({
        animate: false,
        steps: [...SAMPLE_STEPS.slice(0, 2), { popover: { title: "None" } }],
        onHighlightStarted: hook("started"),
        onHighlighted: hook("highlighted"),
        onDeselected: hook("deselected"),
        onDestroyed: hook("destroyed"),
      });
      d.drive();
      await nextFrame();
      d.moveNext();
      await nextFrame();
      d.moveNext();
      await nextFrame();
      d.movePrevious();
      await nextFrame();
      d.destroy();

      return trace;
    };

    const full = await run(config => fullDriver(config));
    const headless = await run(createHeadless);

    expect(headless).toEqual(full);
    expect(headless).toContain("highlighted:None:none");
    expect(headless.at(-1)).toBe("destroyed:Step 2:card-1 (api)");
  });

  it("runs onHighlighted without waiting for a frame", async () => {
    vi.spyOn(window, "requestAnimationFrame").mockImplementation(() => 0);
    const onHighlighted = vi.fn();
    const d = createHeadless({ steps: SAMPLE_STEPS, onHighlighted });

    d.drive();
    await Promise.resolve();
    expect(onHighlighted).toHaveBeenCalledTimes(1);
    expect(onHighlighted.mock.calls[0][0]).toBe(document.querySelector("#intro"));
  });

  it("ends cleanly when destroyed before the first step settles", () => {
    const calls: string[] = [];
    const record = (name: string) => (element: Element | undefined, step: DriveStep) =>
      calls.push(`${name}:${(step.element as string) ?? "-"}`);
    const d = createHeadless({
      steps: SAMPLE_STEPS,
      onHighlightStarted: record("started"),
      onHighlighted: record("highlighted"),
      onDeselected: record("deselected"),
      onDestroyed: record("destroyed"),
    });

    d.drive();
    d.destroy();

    expect(calls).toEqual(["started:#intro", "deselected:#intro", "destroyed:#intro"]);
  });

  it("deselects a step that is left before it settles", async () => {
    const calls: string[] = [];
    const record = (name: string) => (element: Element | undefined, step: DriveStep) =>
      calls.push(`${name}:${step.element as string}`);
    const d = createHeadless({
      steps: SAMPLE_STEPS,
      onHighlightStarted: record("started"),
      onHighlighted: record("highlighted"),
      onDeselected: record("deselected"),
    });

    d.drive();
    d.moveNext();
    await Promise.resolve();

    expect(calls).toEqual([
      "started:#intro",
      "deselected:#intro",
      `started:${SAMPLE_STEPS[1].element}`,
      `highlighted:${SAMPLE_STEPS[1].element}`,
    ]);
  });

  it("asks onDestroyStarted before closing", async () => {
    const onDestroyStarted = vi.fn();
    const d = createHeadless({ steps: SAMPLE_STEPS, onDestroyStarted });
    d.drive();
    await nextFrame();
    d.moveTo(2);
    await nextFrame();
    d.moveNext();

    expect(onDestroyStarted).toHaveBeenCalledTimes(1);
    expect(onDestroyStarted.mock.calls[0][2].reason).toBe("done");
    expect(d.isActive()).toBe(true);
  });

  it("ignores the keyboard", async () => {
    const d = createHeadless({ steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    pressKey("ArrowRight");
    pressKey("Escape");

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
  });

  it("highlights a single element", async () => {
    const onHighlighted = vi.fn();
    const d = createHeadless();
    d.highlight({ element: "#card-1", onHighlighted });
    await nextFrame();

    expect(d.getActiveElement()).toBe(document.querySelector("#card-1"));
    expect(onHighlighted).toHaveBeenCalledWith(document.querySelector("#card-1"), expect.anything(), expect.anything());
  });

  it("makes updatePopover and nudge harmless", async () => {
    const before = snapshot();
    const d = createHeadless({ steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    d.updatePopover({ title: "Changed" });
    d.nudge("Try again");

    expect(snapshot()).toBe(before);
  });
});

describe("headless advanceOn", () => {
  it("moves on when the event fires on the target", async () => {
    const d = createHeadless({ steps: [{ element: "#card-1", advanceOn: "click" }, SAMPLE_STEPS[2]] });
    d.drive();
    await nextFrame();

    click("#intro");
    await tick();
    expect(d.getActiveIndex()).toBe(0);

    click("#card-1");
    await tick();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("checks when() before moving on", async () => {
    const field = append("name", "input") as HTMLInputElement;
    const d = createHeadless({
      steps: [
        {
          element: "#name",
          advanceOn: { event: "input", when: element => (element as HTMLInputElement).value === "ok" },
        },
        SAMPLE_STEPS[0],
      ],
    });
    d.drive();
    await nextFrame();

    field.value = "no";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(d.getActiveIndex()).toBe(0);

    field.value = "ok";
    field.dispatchEvent(new Event("input", { bubbles: true }));
    await tick();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("follows a target that the app redraws", async () => {
    const d = createHeadless({ steps: [{ element: "#card-1", advanceOn: "click" }, SAMPLE_STEPS[2]] });
    d.drive();
    await nextFrame();

    document.querySelector("#card-1")!.remove();
    const redrawn = append("card-1");
    await nextFrame();
    await nextFrame();

    expect(d.getActiveElement()).toBe(redrawn);

    click("#card-1");
    await tick();
    expect(d.getActiveIndex()).toBe(1);
  });

  it("tells onElementReplaced about the redrawn target", async () => {
    const onElementReplaced = vi.fn();
    const d = createHeadless({ onElementReplaced, steps: [{ element: "#card-1" }, SAMPLE_STEPS[2]] });
    d.drive();
    await nextFrame();

    document.querySelector("#card-1")!.remove();
    const redrawn = append("card-1");
    await nextFrame();
    await nextFrame();

    expect(onElementReplaced).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onElementReplaced.mock.calls[0];
    expect(element).toBe(redrawn);
    expect(step.element).toBe("#card-1");
    expect(opts.index).toBe(0);
  });

  it("advance() completes the step", async () => {
    const d = createHeadless({ steps: [{ element: "#card-1", advanceOn: "click" }, SAMPLE_STEPS[2]] });
    d.drive();
    await nextFrame();

    d.advance();
    await nextFrame();
    expect(d.getActiveIndex()).toBe(1);
  });
});

describe("headless onInteraction", () => {
  it("tells clicks on the allowed elements from clicks outside, without blocking either", async () => {
    const regions: string[] = [];
    const list = append("list");
    const d = createHeadless({
      steps: [{ element: "#card-1", allowedElements: () => [list] }],
      onInteraction: (_el, _step, opts) => {
        regions.push(opts.region);
      },
    });
    d.drive();
    await nextFrame();

    const outside = new MouseEvent("click", { bubbles: true, cancelable: true });
    const allowed = new MouseEvent("click", { bubbles: true, cancelable: true });
    click("#card-1");
    list.dispatchEvent(allowed);
    document.querySelector("#intro")!.dispatchEvent(outside);

    expect(regions).toEqual(["element", "allowed", "outside"]);
    expect(allowed.defaultPrevented).toBe(false);
    expect(outside.defaultPrevented).toBe(false);
    expect(list.className).toBe("");
  });
});

describe("headless missing elements", () => {
  it("waits for a target that shows up later", async () => {
    const onHighlighted = vi.fn();
    const d = createHeadless({
      steps: [SAMPLE_STEPS[0], { element: "#late", waitForElement: 500, onHighlighted }],
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    expect(d.getActiveIndex()).toBe(0);

    const late = append("late");
    await tick(50);

    expect(d.getActiveIndex()).toBe(1);
    expect(d.getActiveElement()).toBe(late);
    expect(onHighlighted).toHaveBeenCalledTimes(1);
  });

  it("waits for the first target without drawing a placeholder", async () => {
    const before = snapshot();
    const d = createHeadless({ steps: [{ element: "#late", waitForElement: 500, popover: { title: "Late" } }] });
    d.drive();

    expect(snapshot()).toBe(before);
    expect(d.getActiveStep()).toBeUndefined();
    expect(d.getActiveIndex()).toBe(0);

    const late = append("late");
    await tick(50);
    expect(d.getActiveElement()).toBe(late);
  });

  it("skips missing targets with skipMissingElement", async () => {
    const d = createHeadless({ skipMissingElement: true, steps: [{ element: "#nope" }, ...SAMPLE_STEPS] });
    d.drive();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
  });

  it("reports a timeout to onElementMissing", async () => {
    const onElementMissing = vi.fn();
    const d = createHeadless({
      onElementMissing,
      steps: [SAMPLE_STEPS[0], { element: "#never", waitForElement: 30 }],
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    await tick(60);

    expect(onElementMissing).toHaveBeenCalledTimes(1);
    expect(onElementMissing.mock.calls[0][2]).toMatchObject({ cause: "timeout", index: 1 });
  });

  it("reports a removed target to onElementMissing", async () => {
    const onElementMissing = vi.fn();
    const d = createHeadless({ onElementMissing, steps: [SAMPLE_STEPS[1], SAMPLE_STEPS[2]] });
    d.drive();
    await nextFrame();

    document.querySelector("#card-1")!.remove();
    await nextFrame();
    await nextFrame();

    expect(onElementMissing).toHaveBeenCalledTimes(1);
    expect(onElementMissing.mock.calls[0][2]).toMatchObject({ cause: "removed" });
  });
});

describe("headless onWaitingForElement", () => {
  it("reports the first wait, and destroy() ends it and runs onDestroyed", () => {
    const onWaitingForElement = vi.fn();
    const onDestroyed = vi.fn();
    const d = createHeadless({
      onWaitingForElement,
      onDestroyed,
      steps: [{ element: "#late", waitForElement: 500 }],
    });
    d.drive();

    expect(onWaitingForElement).toHaveBeenCalledTimes(1);
    const [element, step, opts] = onWaitingForElement.mock.calls[0];
    expect(element).toBeUndefined();
    expect(step.element).toBe("#late");
    expect(opts).toMatchObject({ index: 0 });

    d.destroy();
    expect(opts.signal.aborted).toBe(true);
    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onDestroyed.mock.calls[0][1].element).toBe("#late");
  });

  it("can move on from the first wait", async () => {
    const d = createHeadless({ steps: [{ element: "#late", waitForElement: 500 }, SAMPLE_STEPS[0]] });
    d.drive();
    d.moveNext();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
  });

  it("ends the wait when the element appears", async () => {
    const onWaitingForElement = vi.fn();
    const onHighlighted = vi.fn();
    const d = createHeadless({
      onWaitingForElement,
      onHighlighted,
      steps: [SAMPLE_STEPS[0], { element: "#late", waitForElement: 500 }],
    });
    d.drive();
    await nextFrame();
    d.moveNext();

    const { signal } = onWaitingForElement.mock.calls[0][2];
    expect(onWaitingForElement.mock.calls[0][2]).toMatchObject({ index: 1 });
    signal.addEventListener("abort", () => expect(onHighlighted).toHaveBeenCalledTimes(1));

    const late = append("late");
    await tick(50);

    expect(signal.aborted).toBe(true);
    expect(onHighlighted).toHaveBeenCalledTimes(2);
    expect(d.getActiveElement()).toBe(late);
  });

  it("reports a removed target while it waits for it to come back", async () => {
    const onWaitingForElement = vi.fn();
    const onElementMissing = vi.fn();
    const d = createHeadless({
      onWaitingForElement,
      onElementMissing,
      steps: [{ ...SAMPLE_STEPS[1], waitForElement: 500 }, SAMPLE_STEPS[2]],
    });
    d.drive();
    await nextFrame();

    const card = document.querySelector("#card-1")!;
    card.remove();
    await nextFrame();
    await nextFrame();

    expect(onWaitingForElement).toHaveBeenCalledTimes(1);
    const [element, , opts] = onWaitingForElement.mock.calls[0];
    expect(element).toBe(card);
    expect(opts).toMatchObject({ index: 0 });

    document.body.appendChild(card);
    await nextFrame();
    await nextFrame();

    expect(opts.signal.aborted).toBe(true);
    expect(onElementMissing).not.toHaveBeenCalled();
  });
});

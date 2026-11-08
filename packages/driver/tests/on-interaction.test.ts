import { describe, expect, it, vi } from "vitest";
import { createDriver, navButton, nextFrame, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

function fire(target: Element | null, type: string, init: MouseEventInit = {}): MouseEvent {
  if (!target) {
    throw new Error(`No target for ${type}`);
  }

  const event = new MouseEvent(type, { bubbles: true, cancelable: true, composed: true, ...init });
  target.dispatchEvent(event);
  return event;
}

function keyEvent(type: "keydown" | "keyup", init: KeyboardEventInit, target: Element | null = document.activeElement) {
  const event = new KeyboardEvent(type, { bubbles: true, cancelable: true, composed: true, ...init });
  (target || document.body).dispatchEvent(event);
  return event;
}

const $ = (selector: string) => document.querySelector(selector);
const overlayPath = () => $(".driver-overlay path");

async function start(config: Parameters<typeof createDriver>[0] = {}) {
  const d = createDriver({ animate: false, steps: SAMPLE_STEPS, ...config });
  d.drive();
  await nextFrame();
  return d;
}

describe("onInteraction", () => {
  describe("reporting", () => {
    it("reports a click on the highlighted element with region element", async () => {
      const onInteraction = vi.fn();
      const d = await start({ onInteraction });

      const event = fire($("#intro"), "click");

      expect(onInteraction).toHaveBeenCalledTimes(1);
      const [element, step, opts] = onInteraction.mock.calls[0];
      expect(element).toBe($("#intro"));
      expect(step.popover.title).toBe("Step 1");
      expect(opts.event).toBe(event);
      expect(opts.region).toBe("element");
      expect(opts.driver).toBe(d);
      expect(opts.index).toBe(0);
    });

    it("reports clicks elsewhere with region outside", async () => {
      const onInteraction = vi.fn();
      await start({ onInteraction });

      fire($("#card-1"), "click");
      fire(overlayPath(), "click");

      expect(onInteraction.mock.calls.map(call => call[2].region)).toEqual(["outside", "outside"]);
    });

    it("reports contextmenu, dblclick and auxclick", async () => {
      const onInteraction = vi.fn();
      await start({ onInteraction });

      fire($("#intro"), "contextmenu", { button: 2 });
      fire($("#intro"), "dblclick");
      fire($("#intro"), "auxclick", { button: 1 });

      expect(onInteraction.mock.calls.map(call => call[2].event.type)).toEqual(["contextmenu", "dblclick", "auxclick"]);
    });

    it("reports a right-click once, as contextmenu", async () => {
      const onInteraction = vi.fn();
      await start({ onInteraction });

      fire($("#intro"), "auxclick", { button: 2 });
      fire($("#intro"), "contextmenu", { button: 2 });

      expect(onInteraction).toHaveBeenCalledTimes(1);
      expect(onInteraction.mock.calls[0][2].event.type).toBe("contextmenu");
    });

    it("does not report pointerdown or mousedown", async () => {
      const onInteraction = vi.fn();
      await start({ onInteraction });

      fire($("#intro"), "pointerdown");
      fire($("#intro"), "mousedown");
      fire($("#intro"), "mouseup");

      expect(onInteraction).not.toHaveBeenCalled();
    });

    it("does not report clicks inside the popover", async () => {
      const onInteraction = vi.fn();
      const d = await start({ onInteraction });

      navButton("next")?.click();

      expect(onInteraction).not.toHaveBeenCalled();
      expect(d.getActiveIndex()).toBe(1);
    });

    it("prefers the step hook over the config hook", async () => {
      const configHook = vi.fn();
      const stepHook = vi.fn();
      await start({
        onInteraction: configHook,
        steps: [{ ...SAMPLE_STEPS[0], onInteraction: stepHook }, ...SAMPLE_STEPS.slice(1)],
      });

      fire($("#intro"), "click");

      expect(stepHook).toHaveBeenCalledTimes(1);
      expect(configHook).not.toHaveBeenCalled();
    });

    it("stops reporting after destroy", async () => {
      const onInteraction = vi.fn();
      const d = await start({ onInteraction });
      d.destroy();

      fire($("#intro"), "click");
      expect(onInteraction).not.toHaveBeenCalled();
    });
  });

  describe("consuming", () => {
    it("lets the event through unless the hook returns false", async () => {
      const appHandler = vi.fn();
      $("#intro")?.addEventListener("click", appHandler);
      await start({ onInteraction: () => undefined });

      const event = fire($("#intro"), "click");

      expect(appHandler).toHaveBeenCalledTimes(1);
      expect(event.defaultPrevented).toBe(false);
    });

    it("stops the app from seeing a consumed event", async () => {
      const appHandler = vi.fn();
      const documentHandler = vi.fn();
      $("#intro")?.addEventListener("click", appHandler);
      document.addEventListener("click", documentHandler, true);
      await start({ onInteraction: () => false });

      const event = fire($("#intro"), "click");

      expect(appHandler).not.toHaveBeenCalled();
      expect(documentHandler).not.toHaveBeenCalled();
      expect(event.defaultPrevented).toBe(true);
      document.removeEventListener("click", documentHandler, true);
    });

    it("keeps the tour open when a consumed click lands on the overlay", async () => {
      const d = await start({ onInteraction: () => false });

      fire(overlayPath(), "click");

      expect(d.isActive()).toBe(true);
    });

    it("still applies overlayClickBehavior when the hook lets the click through", async () => {
      const d = await start({ onInteraction: () => undefined });

      fire(overlayPath(), "click");

      expect(d.isActive()).toBe(false);
    });

    it("never completes a step with a consumed event", async () => {
      const d = await start({
        steps: [{ ...SAMPLE_STEPS[0], advanceOn: "click" }, ...SAMPLE_STEPS.slice(1)],
        onInteraction: () => false,
      });

      fire($("#intro"), "click");
      await new Promise(resolve => setTimeout(resolve, 0));

      expect(d.getActiveIndex()).toBe(0);
    });

    it("can reject the wrong action and accept the right one", async () => {
      const d = await start({
        steps: [{ ...SAMPLE_STEPS[0], advanceOn: "contextmenu" }, ...SAMPLE_STEPS.slice(1)],
        onInteraction: (_el, _step, opts) => {
          if (opts.region === "element" && opts.event.type === "click") {
            return false;
          }
        },
      });

      fire($("#intro"), "click");
      expect(d.getActiveIndex()).toBe(0);

      fire($("#intro"), "contextmenu", { button: 2 });
      expect(d.getActiveIndex()).toBe(1);
    });
  });

  it("does not report key presses", async () => {
    const onInteraction = vi.fn();
    await start({ onInteraction });

    (document.querySelector("#card-1") as HTMLElement).focus();
    keyEvent("keydown", { key: "a", code: "KeyA" });
    keyEvent("keyup", { key: "a", code: "KeyA" });

    expect(onInteraction).not.toHaveBeenCalled();
  });
});

describe("keyboard ownership", () => {
  function addInput() {
    const input = document.createElement("input");
    input.id = "field";
    document.querySelector("#intro")?.appendChild(input);
    return input;
  }

  it("lets Escape inside the highlighted element belong to the app", async () => {
    const input = addInput();
    const d = await start();

    input.focus();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, input);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, input);

    expect(d.isActive()).toBe(true);
  });

  it("lets arrows inside the highlighted element belong to the app", async () => {
    const input = addInput();
    const d = await start();

    input.focus();
    keyEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }, input);

    expect(d.getActiveIndex()).toBe(0);
  });

  it("does not act on a driver key the app already handled", async () => {
    const d = await start();
    const appEscape = (e: KeyboardEvent) => e.preventDefault();
    document.body.addEventListener("keydown", appEscape);

    keyEvent("keydown", { key: "Escape", code: "Escape" }, document.body);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, document.body);

    expect(d.isActive()).toBe(true);
    document.body.removeEventListener("keydown", appEscape);
  });

  it("advances with ArrowRight while a plain button in the highlighted element has focus", async () => {
    const button = document.createElement("button");
    document.querySelector("#intro")?.appendChild(button);
    const d = await start();

    button.focus();
    keyEvent("keydown", { key: "ArrowRight", code: "ArrowRight" }, button);
    keyEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }, button);

    expect(d.getActiveIndex()).toBe(1);
  });

  it("closes on Escape while a plain button in the highlighted element has focus", async () => {
    const button = document.createElement("button");
    document.querySelector("#intro")?.appendChild(button);
    const d = await start();

    button.focus();
    keyEvent("keydown", { key: "Escape", code: "Escape" }, button);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, button);

    expect(d.isActive()).toBe(false);
  });

  it("lets arrows inside a menu in the highlighted element belong to the app", async () => {
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    menu.innerHTML = `<button role="menuitem">Rename</button>`;
    document.querySelector("#intro")?.appendChild(menu);
    const item = menu.querySelector("button") as HTMLButtonElement;
    const d = await start();

    item.focus();
    keyEvent("keydown", { key: "ArrowRight", code: "ArrowRight" }, item);
    keyEvent("keyup", { key: "ArrowRight", code: "ArrowRight" }, item);

    expect(d.getActiveIndex()).toBe(0);
  });

  it("still closes on Escape when focus is outside", async () => {
    const d = await start();

    keyEvent("keydown", { key: "Escape", code: "Escape" }, document.body);
    keyEvent("keyup", { key: "Escape", code: "Escape" }, document.body);

    expect(d.isActive()).toBe(false);
  });
});

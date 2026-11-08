import { afterEach, describe, expect, it, vi } from "vitest";
import { createDriver, nextFrame, popoverEl, SAMPLE_STEPS, useDriverHarness } from "./utils";

useDriverHarness();

const ALLOWED = "driver-allowed-element";
const $ = (selector: string) => document.querySelector(selector);
const isAllowed = (selector: string) => !!$(selector)?.classList.contains(ALLOWED);

function addMenu(id = "menu") {
  const menu = document.createElement("div");
  menu.id = id;
  menu.className = "context-menu";
  menu.innerHTML = `<button class="menu-item" type="button">Rename</button>`;
  document.body.appendChild(menu);
  return menu;
}

const withFirst = (extra: object) => [{ ...SAMPLE_STEPS[0], ...extra }, ...SAMPLE_STEPS.slice(1)];

async function start(config: Parameters<typeof createDriver>[0]) {
  const d = createDriver({ animate: false, ...config });
  d.drive();
  await nextFrame();
  return d;
}

describe("allowedElements", () => {
  it("marks elements matching a selector", async () => {
    addMenu();
    await start({ steps: withFirst({ allowedElements: ".context-menu" }) });

    expect(isAllowed(".context-menu")).toBe(true);
  });

  it("accepts an element, a list and a resolver", async () => {
    const menu = addMenu();
    addMenu("other");
    const d = await start({
      steps: [
        { ...SAMPLE_STEPS[0], allowedElements: menu },
        { ...SAMPLE_STEPS[1], allowedElements: ["#other", $("#intro")!] },
        { ...SAMPLE_STEPS[2], allowedElements: () => document.querySelectorAll(".menu-item") },
      ],
    });
    expect(isAllowed("#menu")).toBe(true);

    d.moveNext();
    await nextFrame();
    expect(isAllowed("#other")).toBe(true);
    expect(isAllowed("#intro")).toBe(true);
    expect(isAllowed("#menu")).toBe(false);

    d.moveNext();
    await nextFrame();
    expect(isAllowed(".menu-item")).toBe(true);
    expect(isAllowed("#other")).toBe(false);
  });

  it("unmarks elements when the step is left and on destroy", async () => {
    addMenu();
    const d = await start({ steps: withFirst({ allowedElements: ".context-menu" }) });

    d.moveNext();
    await nextFrame();
    expect(isAllowed(".context-menu")).toBe(false);

    d.movePrevious();
    await nextFrame();
    expect(isAllowed(".context-menu")).toBe(true);

    d.destroy();
    expect(isAllowed(".context-menu")).toBe(false);
  });

  it("marks matches that appear after the step starts", async () => {
    await start({ steps: withFirst({ allowedElements: ".context-menu" }) });

    addMenu();
    await Promise.resolve();
    await nextFrame();

    expect(isAllowed(".context-menu")).toBe(true);
  });

  it("unmarks elements that stop matching", async () => {
    const menu = addMenu();
    menu.setAttribute("data-state", "open");
    await start({ steps: withFirst({ allowedElements: "[data-state=open]" }) });
    expect(menu.classList.contains(ALLOWED)).toBe(true);

    menu.setAttribute("data-state", "closed");
    await Promise.resolve();
    await nextFrame();

    expect(menu.classList.contains(ALLOWED)).toBe(false);
  });

  it("re-resolves a resolver on refresh", async () => {
    let target: Element | undefined;
    const d = await start({ steps: withFirst({ allowedElements: () => (target ? [target] : []) }) });

    target = addMenu();
    d.refresh();
    await nextFrame();

    expect(target.classList.contains(ALLOWED)).toBe(true);
  });

  it("prefers the step value over the config value", async () => {
    addMenu();
    addMenu("other");
    await start({ allowedElements: "#other", steps: withFirst({ allowedElements: "#menu" }) });

    expect(isAllowed("#menu")).toBe(true);
    expect(isAllowed("#other")).toBe(false);
  });

  it("is applied from the config to every step", async () => {
    addMenu();
    const d = await start({ allowedElements: ".context-menu", steps: SAMPLE_STEPS });
    expect(isAllowed(".context-menu")).toBe(true);

    d.moveNext();
    await nextFrame();
    expect(isAllowed(".context-menu")).toBe(true);
  });

  it("reports interactions inside an allowed element with region allowed", async () => {
    addMenu();
    const onInteraction = vi.fn();
    await start({ onInteraction, steps: withFirst({ allowedElements: ".context-menu" }) });

    $(".menu-item")?.dispatchEvent(new MouseEvent("click", { bubbles: true, composed: true }));

    expect(onInteraction.mock.calls[0][2].region).toBe("allowed");
  });

  it("leaves classes the app put on the element alone", async () => {
    const menu = addMenu();
    menu.classList.add("app-class");
    const d = await start({ steps: withFirst({ allowedElements: ".context-menu" }) });
    d.destroy();

    expect(menu.className).toBe("context-menu app-class");
  });
});

describe("focus", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeVisible() {
    vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockImplementation(function (this: HTMLElement) {
      for (let node: HTMLElement | null = this; node; node = node.parentElement) {
        if (node.style.display === "none") {
          return 0;
        }
      }

      return 10;
    });
  }

  it("moves focus to the popover when focus is elsewhere", async () => {
    makeVisible();
    await start({ steps: SAMPLE_STEPS });

    expect(popoverEl()?.contains(document.activeElement)).toBe(true);
  });

  it("does not take focus from the highlighted element", async () => {
    makeVisible();
    const button = $("#card-1") as HTMLButtonElement;
    button.focus();

    await start({ steps: [{ element: "#card-1", popover: { title: "Press it", description: "Go on" } }] });

    expect(document.activeElement).toBe(button);
  });

  it("does not take focus from an allowed element", async () => {
    makeVisible();
    addMenu();
    const item = $(".menu-item") as HTMLButtonElement;
    item.focus();

    await start({ steps: withFirst({ allowedElements: ".context-menu" }) });

    expect(document.activeElement).toBe(item);
  });

  it("announces the step when it leaves focus where it was", async () => {
    makeVisible();
    ($("#card-1") as HTMLButtonElement).focus();

    await start({ steps: [{ element: "#card-1", popover: { title: "Press it", description: "Go on" } }] });

    expect($(".driver-live-region")?.textContent).toBe("Press it. Go on");
  });

  it("includes allowed elements in the Tab trap", async () => {
    makeVisible();
    addMenu();
    await start({ steps: withFirst({ allowedElements: ".context-menu", popover: { showButtons: [] } }) });

    const item = $(".menu-item") as HTMLButtonElement;
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));

    expect(document.activeElement).toBe(item);
  });

  it("treats tabindex and contenteditable elements as focusable", async () => {
    makeVisible();
    const custom = document.createElement("div");
    custom.setAttribute("tabindex", "0");
    $("#intro")?.appendChild(custom);
    await start({ steps: withFirst({ popover: { showButtons: [] } }) });

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", cancelable: true }));

    expect(document.activeElement).toBe(custom);
  });
});

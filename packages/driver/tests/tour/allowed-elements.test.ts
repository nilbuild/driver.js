import { describe, expect, it, vi } from "vitest";
import { append, createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "../utils";

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

  it("leaves classes the app put on the element alone", async () => {
    const menu = addMenu();
    menu.classList.add("app-class");
    const d = await start({ steps: withFirst({ allowedElements: ".context-menu" }) });
    d.destroy();

    expect(menu.className).toBe("context-menu app-class");
  });

  it("settles instead of re-running every frame", async () => {
    const menu = append("menu", "div");
    const resolver = vi.fn(() => [menu]);
    createDriver({ animate: false, steps: [{ ...SAMPLE_STEPS[0], allowedElements: resolver }] }).drive();
    await nextFrame();

    document.body.appendChild(document.createElement("span"));
    for (let i = 0; i < 5; i++) {
      await nextFrame();
    }
    const settledCount = resolver.mock.calls.length;

    for (let i = 0; i < 5; i++) {
      await nextFrame();
    }
    expect(resolver.mock.calls.length).toBe(settledCount);
  });
});

describe("allowedElements re-sync", () => {
  it("picks up a selector match made by an attribute other than class", async () => {
    const menu = append("menu", "div");
    const d = createDriver({
      animate: false,
      steps: [
        { element: "#intro", allowedElements: "#menu[data-open], #menu:not([hidden]).x", popover: { title: "A" } },
      ],
    });
    d.drive();
    await nextFrame();
    expect(isAllowed("#menu")).toBe(false);

    menu.setAttribute("data-open", "");
    await nextFrame();
    await nextFrame();
    expect(isAllowed("#menu")).toBe(true);

    menu.removeAttribute("data-open");
    await nextFrame();
    await nextFrame();
    expect(isAllowed("#menu")).toBe(false);
  });

  it("picks up a function result that depends on style", async () => {
    const menu = append("menu", "div");
    menu.style.display = "none";
    const d = createDriver({
      animate: false,
      steps: [
        {
          element: "#intro",
          allowedElements: () => (menu.style.display === "none" ? [] : [menu]),
          popover: { title: "A" },
        },
      ],
    });
    d.drive();
    await nextFrame();
    expect(isAllowed("#menu")).toBe(false);

    menu.style.display = "block";
    await nextFrame();
    await nextFrame();
    expect(isAllowed("#menu")).toBe(true);
  });
});

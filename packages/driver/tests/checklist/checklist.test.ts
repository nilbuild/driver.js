import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type Driver } from "../../src/driver";
import { checklist, type Checklist, type ChecklistConfig, type ChecklistItem } from "../../src/checklist";
import { DEMO_HTML, navButton, nextFrame, SAMPLE_STEPS } from "../utils";

let active: Checklist | undefined;
let activeDriver: Driver | undefined;

function createChecklist(config: Partial<ChecklistConfig> = {}): Checklist {
  active = checklist({ id: "onboarding", items: ITEMS, ...config });
  return active;
}

const ITEMS: ChecklistItem[] = [
  { id: "tour", title: "Take the tour", tour: { animate: false, steps: SAMPLE_STEPS.slice(0, 2) } },
  { id: "docs", title: "Read the docs", href: "#docs" },
  { id: "invite", title: "Invite a teammate", action: () => {} },
];

const root = () => document.querySelector<HTMLElement>(".driver-checklist");
const panel = () => document.querySelector<HTMLElement>(".driver-checklist-panel");
const launcher = () => document.querySelector<HTMLButtonElement>(".driver-checklist-launcher");
const launcherCount = () => document.querySelector(".driver-checklist-launcher-count")?.textContent;
const progressText = () => document.querySelector(".driver-checklist-progress-text")?.textContent;
const trigger = (id: string) =>
  document.querySelector<HTMLElement>(`.driver-checklist-item-trigger[data-item-id="${id}"]`);
const isDone = (id: string) => !!trigger(id)?.closest(".driver-checklist-item-done");

async function finishTour() {
  await nextFrame();
  navButton("next")?.click();
  navButton("next")?.click();
}

beforeEach(() => {
  document.body.innerHTML = DEMO_HTML;
});

afterEach(() => {
  active?.hide();
  active = undefined;
  activeDriver?.destroy();
  activeDriver = undefined;
  document.body.innerHTML = "";
  vi.restoreAllMocks();
});

describe("checklist rendering", () => {
  it("renders a launcher with the progress count and a closed panel", () => {
    createChecklist().show();

    expect(root()?.classList.contains("driver-checklist-bottom-right")).toBe(true);
    expect(launcherCount()).toBe("0/3");
    expect(progressText()).toBe("0 of 3");
    expect(panel()?.hidden).toBe(true);
    expect(launcher()?.getAttribute("aria-expanded")).toBe("false");
    expect(launcher()?.getAttribute("aria-controls")).toBe(panel()?.id);
  });

  it("renders link items as anchors, actionable items as buttons and the rest as plain rows", () => {
    createChecklist({ items: [...ITEMS, { id: "info", title: "Done in the app" }] }).show();

    expect(trigger("docs")?.tagName).toBe("A");
    expect(trigger("docs")?.getAttribute("href")).toBe("#docs");
    expect(trigger("tour")?.tagName).toBe("BUTTON");
    expect(trigger("invite")?.tagName).toBe("BUTTON");
    expect(trigger("info")?.tagName).toBe("DIV");
  });

  it("uses the configured title, launcher text, progress text and position", () => {
    createChecklist({
      title: "Welcome",
      launcherText: "Setup",
      progressText: "{{done}}/{{total}} steps",
      position: "bottom-left",
    }).show();

    expect(document.querySelector(".driver-checklist-title")?.textContent).toBe("Welcome");
    expect(document.querySelector(".driver-checklist-launcher-text")?.textContent).toBe("Setup");
    expect(progressText()).toBe("0/3 steps");
    expect(root()?.classList.contains("driver-checklist-bottom-left")).toBe(true);
  });

  it("formats the launcher count with launcherProgressText, and hides it when empty", () => {
    const list = createChecklist({ launcherProgressText: "{{done}} of {{total}}" });
    list.show();
    list.complete("tour");
    expect(launcherCount()).toBe("1 of 3");
    list.hide();

    createChecklist({ launcherProgressText: "" }).show();
    expect(document.querySelector<HTMLElement>(".driver-checklist-launcher-count")?.hidden).toBe(true);
  });

  it("fills in {{percent}} and {{remaining}}, and exposes the progress to CSS", () => {
    const list = createChecklist({
      progressText: "{{percent}}% complete",
      launcherProgressText: "{{remaining}} left",
    });
    list.show();
    list.complete("tour");

    expect(progressText()).toBe("33% complete");
    expect(launcherCount()).toBe("2 left");
    expect(root()?.style.getPropertyValue("--driver-checklist-progress")).toBe("33%");
  });

  it("replaces every occurrence of a placeholder", () => {
    createChecklist({ progressText: "{{done}}/{{total}}, {{done}} done" }).show();

    expect(progressText()).toBe("0/3, 0 done");
  });

  it("switches to the complete texts once every item is done, and back when one is unticked", () => {
    const list = createChecklist({
      title: "Get started",
      description: "Three steps.",
      launcherText: "Setup",
      completeTitle: "You're all set! 🎉",
      completeDescription: "Thanks for getting started.",
      completeLauncherText: "All done",
    });
    list.show();

    const title = () => document.querySelector(".driver-checklist-title")?.textContent;
    const description = () => document.querySelector<HTMLElement>(".driver-checklist-description");
    const launcherText = () => document.querySelector(".driver-checklist-launcher-text")?.textContent;

    ["tour", "docs", "invite"].forEach(id => list.complete(id));
    expect(title()).toBe("You're all set! 🎉");
    expect(description()?.textContent).toBe("Thanks for getting started.");
    expect(launcherText()).toBe("All done");
    expect(panel()?.getAttribute("aria-label")).toBe("You're all set! 🎉");

    list.uncomplete("docs");
    expect(title()).toBe("Get started");
    expect(description()?.textContent).toBe("Three steps.");
    expect(launcherText()).toBe("Setup");
  });

  it("keeps the regular texts when no complete texts are set, and hides an empty description", () => {
    createChecklist({ title: "Get started", completed: ["tour", "docs", "invite"] }).show();

    expect(document.querySelector(".driver-checklist-title")?.textContent).toBe("Get started");
    expect(document.querySelector(".driver-checklist-launcher-text")?.textContent).toBe("Get started");
    expect(document.querySelector<HTMLElement>(".driver-checklist-description")?.hidden).toBe(true);
  });

  it("can clear the description once done with an empty completeDescription", () => {
    createChecklist({
      description: "Three steps.",
      completeDescription: "",
      completed: ["tour", "docs", "invite"],
    }).show();

    expect(document.querySelector<HTMLElement>(".driver-checklist-description")?.hidden).toBe(true);
  });

  it("marks items passed in through completed without firing completion hooks", () => {
    const onItemComplete = vi.fn();
    const onComplete = vi.fn();
    createChecklist({ completed: ["tour", "docs", "invite"], onItemComplete, onComplete }).show();

    expect(isDone("tour")).toBe(true);
    expect(launcherCount()).toBe("3/3");
    expect(root()?.classList.contains("driver-checklist-complete")).toBe(true);
    expect(onItemComplete).not.toHaveBeenCalled();
    expect(onComplete).not.toHaveBeenCalled();
  });

  it("does not replace the description DOM when the HTML string is unchanged", () => {
    const list = createChecklist({ description: '<img src="a.gif" />' });
    list.show();

    const img = document.querySelector<HTMLElement>(".driver-checklist-description img");
    list.complete("tour");

    expect(document.querySelector(".driver-checklist-description img")).toBe(img);
  });

  it("removes everything on hide()", () => {
    const list = createChecklist();
    list.show();
    list.hide();

    expect(root()).toBeNull();
    expect(list.isVisible()).toBe(false);
  });
});

describe("opening and closing", () => {
  it("toggles the panel from the launcher", () => {
    const list = createChecklist();
    list.show();

    launcher()?.click();
    expect(panel()?.hidden).toBe(false);
    expect(launcher()?.getAttribute("aria-expanded")).toBe("true");
    expect(list.isOpen()).toBe(true);

    launcher()?.click();
    expect(panel()?.hidden).toBe(true);
  });

  it("renders without a launcher when launcher is false", () => {
    const list = createChecklist({ launcher: false });
    list.show();

    expect(launcher()).toBeNull();
    expect(root()?.classList.contains("driver-checklist-no-launcher")).toBe(true);

    list.open();
    expect(panel()?.hidden).toBe(false);
  });
});

describe("progress", () => {
  it("completes items, reports progress and fires onComplete once", () => {
    const onItemComplete = vi.fn();
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const list = createChecklist({ onItemComplete, onProgress, onComplete });
    list.show();

    list.complete("tour");
    expect(isDone("tour")).toBe(true);
    expect(onItemComplete).toHaveBeenCalledWith(ITEMS[0], { checklist: list });
    expect(onProgress).toHaveBeenLastCalledWith({ completed: ["tour"], done: 1, total: 3 });

    list.complete("tour");
    expect(onItemComplete).toHaveBeenCalledTimes(1);

    list.complete("docs");
    list.complete("invite");
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(root()?.classList.contains("driver-checklist-complete")).toBe(true);
  });

  it("ignores unknown item ids", () => {
    const onProgress = vi.fn();
    const list = createChecklist({ onProgress });

    list.complete("missing");

    expect(onProgress).not.toHaveBeenCalled();
  });

  it("keeps completed ids of items that are not in the list", () => {
    const list = createChecklist({ completed: ["elsewhere"] });

    list.complete("docs");

    expect(list.getProgress()).toEqual({ completed: ["elsewhere", "docs"], done: 1, total: 3 });
  });

  it("works before show() and renders the progress once shown", () => {
    const list = createChecklist();
    list.complete("docs");
    list.show();

    expect(isDone("docs")).toBe(true);
  });

  it("clears progress on reset()", () => {
    const onProgress = vi.fn();
    const onComplete = vi.fn();
    const list = createChecklist({ completed: ["tour", "docs"], onProgress, onComplete });
    list.show();

    list.reset();
    expect(isDone("tour")).toBe(false);
    expect(onProgress).toHaveBeenLastCalledWith({ completed: [], done: 0, total: 3 });

    list.complete("tour");
    list.complete("docs");
    list.complete("invite");
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it("completes items whose completeWhen passes on show() and refresh()", () => {
    let connected = false;
    const list = createChecklist({
      items: [{ id: "github", title: "Connect GitHub", completeWhen: () => connected }],
    });

    list.show();
    expect(isDone("github")).toBe(false);

    connected = true;
    list.refresh();
    expect(isDone("github")).toBe(true);
  });
});

describe("tours", () => {
  it("closes the panel, runs the tour and ticks the item when it is finished", async () => {
    const list = createChecklist();
    list.show();
    list.open();

    trigger("tour")?.click();
    expect(list.isOpen()).toBe(false);
    expect(document.body.classList.contains("driver-active")).toBe(true);

    await finishTour();

    expect(document.body.classList.contains("driver-active")).toBe(false);
    expect(isDone("tour")).toBe(true);
    expect(list.isOpen()).toBe(true);
  });

  it("leaves the item open when the tour is closed early, and reopens the panel", async () => {
    const list = createChecklist();
    list.show();

    list.start("tour");
    await nextFrame();
    navButton("close")?.click();

    expect(isDone("tour")).toBe(false);
    expect(list.isOpen()).toBe(true);
  });

  it("accepts plain steps", async () => {
    const list = createChecklist({
      items: [{ id: "steps", title: "Steps", tour: [{ element: "#intro", popover: { title: "Only" } }] }],
    });
    list.show();

    list.start("steps");
    await new Promise(resolve => setTimeout(resolve, 500));
    navButton("next")?.click();

    expect(isDone("steps")).toBe(true);
  });

  it("runs a driver instance, keeping and then restoring its own onDestroyed", async () => {
    const onDestroyed = vi.fn();
    activeDriver = driver({ animate: false, steps: SAMPLE_STEPS.slice(0, 2), onDestroyed });
    const list = createChecklist({ items: [{ id: "own", title: "Own tour", tour: activeDriver }] });
    list.show();

    list.start("own");
    await finishTour();

    expect(onDestroyed).toHaveBeenCalledTimes(1);
    expect(onDestroyed.mock.calls[0][2].reason).toBe("done");
    expect(isDone("own")).toBe(true);
    expect(activeDriver.getConfig().onDestroyed).toBe(onDestroyed);
  });

  it("does not reopen when another tour replaces the item's tour", async () => {
    const list = createChecklist();
    list.show();

    list.start("tour");
    await nextFrame();
    activeDriver = driver({ animate: false, steps: SAMPLE_STEPS });
    activeDriver.drive();

    expect(isDone("tour")).toBe(false);
    expect(list.isOpen()).toBe(false);
  });

  it("lets completeWhen decide for tour items", async () => {
    let created = false;
    const list = createChecklist({
      items: [{ ...ITEMS[0], completeWhen: () => created }],
    });
    list.show();

    list.start("tour");
    await finishTour();
    expect(isDone("tour")).toBe(false);

    created = true;
    list.refresh();
    expect(isDone("tour")).toBe(true);
  });
});

describe("links and actions", () => {
  it("runs the action and ticks the item", () => {
    const action = vi.fn();
    const list = createChecklist({ items: [{ id: "invite", title: "Invite", action }] });
    list.show();

    trigger("invite")?.click();

    expect(action).toHaveBeenCalledWith(list.getItems()[0], { checklist: list });
    expect(isDone("invite")).toBe(true);
  });

  it("checks completeWhen after the action instead of ticking right away", () => {
    let invited = false;
    const list = createChecklist({
      items: [{ id: "invite", title: "Invite", action: () => {}, completeWhen: () => invited }],
    });
    list.show();

    trigger("invite")?.click();
    expect(isDone("invite")).toBe(false);

    invited = true;
    trigger("invite")?.click();
    expect(isDone("invite")).toBe(true);
  });
});

describe("manual completion", () => {
  const check = (id: string) => trigger(id)?.parentElement?.querySelector<HTMLElement>(".driver-checklist-check");

  it("keeps the check circle decorative by default, starting the item on click", () => {
    const action = vi.fn();
    createChecklist({ items: [{ id: "invite", title: "Invite", action }] }).show();

    expect(check("invite")?.tagName).toBe("SPAN");
    check("invite")?.click();

    expect(action).toHaveBeenCalledTimes(1);
  });

  it("lets users tick and untick items with allowManualComplete", () => {
    const onProgress = vi.fn();
    const onEvent = vi.fn();
    createChecklist({ allowManualComplete: true, onProgress, onEvent }).show();

    expect(check("tour")?.tagName).toBe("BUTTON");
    expect(check("tour")?.getAttribute("aria-label")).toBe('Mark "Take the tour" as done');

    check("tour")?.click();
    expect(isDone("tour")).toBe(true);
    expect(check("tour")?.getAttribute("aria-pressed")).toBe("true");
    expect(document.body.classList.contains("driver-active")).toBe(false);

    check("tour")?.click();
    expect(isDone("tour")).toBe(false);
    expect(onProgress).toHaveBeenLastCalledWith({ completed: [], done: 0, total: 3 });
    expect(onEvent.mock.calls.map(([event]) => event.type)).toContain("item_uncompleted");
  });

  it("ticks and unticks a row with nothing to start when its text is clicked", () => {
    createChecklist({ allowManualComplete: true, items: [{ id: "plain", title: "Plain" }] }).show();

    trigger("plain")?.click();
    expect(isDone("plain")).toBe(true);

    trigger("plain")?.click();
    expect(isDone("plain")).toBe(false);
  });

  it("leaves rows with nothing to start alone without allowManualComplete", () => {
    createChecklist({ items: [{ id: "plain", title: "Plain" }] }).show();

    trigger("plain")?.click();
    expect(isDone("plain")).toBe(false);
  });

  it("can be turned on or off per item", () => {
    createChecklist({
      allowManualComplete: true,
      items: [
        { id: "a", title: "A", allowManualComplete: false },
        { id: "b", title: "B" },
      ],
    }).show();

    expect(check("a")?.tagName).toBe("SPAN");
    expect(check("b")?.tagName).toBe("BUTTON");
  });

  it("fires onComplete again after an item is unticked and the list is finished again", () => {
    const onComplete = vi.fn();
    const list = createChecklist({ completed: ["tour", "docs"], onComplete });
    list.show();

    list.complete("invite");
    list.uncomplete("invite");
    list.complete("invite");

    expect(onComplete).toHaveBeenCalledTimes(2);
  });
});

describe("events", () => {
  it("reports what happens through onEvent", async () => {
    const onEvent = vi.fn();
    const list = createChecklist({ onEvent });
    list.show();
    list.open();
    list.start("tour");
    await nextFrame();
    navButton("close")?.click();
    list.complete("docs");

    const events = onEvent.mock.calls.map(([event]) => [event.type, event.itemId, event.reason]);
    expect(events).toEqual([
      ["shown", undefined, undefined],
      ["opened", undefined, undefined],
      ["item_started", "tour", undefined],
      ["closed", undefined, undefined],
      ["tour_ended", "tour", "close"],
      ["opened", undefined, undefined],
      ["item_completed", "docs", undefined],
    ]);
    expect(onEvent.mock.calls[0][0]).toMatchObject({ kind: "checklist", id: "onboarding" });
    expect(typeof onEvent.mock.calls[0][0].timestamp).toBe("number");
  });
});

describe("ids", () => {
  it("warns about duplicate and missing ids", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    createChecklist({
      items: [
        { id: "a", title: "A" },
        { id: "a", title: "Again" },
        { id: "", title: "Nameless" },
      ],
    });

    expect(warn).toHaveBeenCalledWith('[driver.js] Duplicate checklist item id "a".');
    expect(warn).toHaveBeenCalledWith('[driver.js] Checklist item "Nameless" is missing an id.');
  });
});

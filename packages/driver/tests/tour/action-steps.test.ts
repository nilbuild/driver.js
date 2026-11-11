import { afterEach, describe, expect, it, vi } from "vitest";
import type { AdvanceOn, DriveStep } from "../../src/driver";
import { append, createDriver, nextFrame, popoverEl, SAMPLE_STEPS, tick, useDriverHarness } from "../utils";

useDriverHarness();

afterEach(() => {
  vi.restoreAllMocks();
});

const actionStep = (advanceOn?: AdvanceOn): DriveStep => ({
  ...SAMPLE_STEPS[0],
  advanceOn,
  popover: { title: "Act", instruction: "Do it." },
});

async function start(config: Parameters<typeof createDriver>[0], index = 0) {
  const d = createDriver({ animate: false, ...config });
  d.drive(index);
  await nextFrame();
  return d;
}

const withFirst = (step: DriveStep) => [step, ...SAMPLE_STEPS.slice(1)];

describe("onElementMissing presets", () => {
  function addMenu() {
    const more = append("more");
    const menu = append("menu", "div");
    menu.innerHTML = `<p id="menu-info">Info</p><button id="archive" type="button">Archive</button>`;
    return { more, menu };
  }

  const menuSteps = (extra: Partial<DriveStep> = {}): DriveStep[] => [
    { element: "#more", advanceOn: "click", popover: { title: "Open", instruction: "Click More." } },
    { element: "#menu-info", popover: { title: "The menu" } },
    { element: "#archive", advanceOn: "click", ...extra, popover: { title: "Archive", instruction: "Click Archive." } },
  ];

  async function removeMenu(menu: HTMLElement) {
    menu.remove();
    await nextFrame();
    await nextFrame();
  }

  it("stay where they are by default, action step or not", async () => {
    const { menu } = addMenu();
    const d = await start({ steps: menuSteps() }, 2);
    await removeMenu(menu);

    expect(d.getActiveIndex()).toBe(2);
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);
  });

  it('"stay" is the same as leaving it out', async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "stay", steps: menuSteps() }, 1);
    await removeMenu(menu);

    expect(d.getActiveIndex()).toBe(1);
  });

  it('"previous" goes one step back', async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previous", steps: menuSteps() }, 2);
    await removeMenu(menu);
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
  });

  it('"previous" does nothing on the first step', async () => {
    const { more } = addMenu();
    const d = await start({ onElementMissing: "previous", steps: menuSteps() }, 0);
    more.remove();
    await nextFrame();
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
  });

  it('"previousAction" goes back to the last action step the user can still do', async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previousAction", steps: menuSteps() }, 2);
    await removeMenu(menu);

    expect(d.getActiveIndex()).toBe(0);
  });

  it('"previousAction" goes one step back when no earlier action step is on the page', async () => {
    const target = append("target");
    const d = await start(
      {
        onElementMissing: "previousAction",
        steps: [
          SAMPLE_STEPS[0],
          { element: "#target", advanceOn: "click", popover: { title: "Act", instruction: "Click it." } },
        ],
      },
      1
    );

    target.remove();
    await nextFrame();
    await nextFrame();

    expect(d.getActiveIndex()).toBe(0);
  });

  it("a step's own setting wins over the config", async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previous", steps: menuSteps({ onElementMissing: "stay" }) }, 2);
    await removeMenu(menu);

    expect(d.getActiveIndex()).toBe(2);
  });

  it("wait for waitForElement first", async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previousAction", steps: menuSteps({ waitForElement: 100 }) }, 2);

    await removeMenu(menu);
    expect(d.getActiveIndex()).toBe(2);
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);

    document.body.appendChild(menu);
    await tick(150);
    expect(d.getActiveIndex()).toBe(2);
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);
  });

  it("go back once the grace period is over", async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previousAction", steps: menuSteps({ waitForElement: 50 }) }, 2);

    await removeMenu(menu);
    await tick(100);

    expect(d.getActiveIndex()).toBe(0);
  });

  it("leave it to a function when there is one", async () => {
    const { menu } = addMenu();
    const onElementMissing = vi.fn();
    const d = await start({ onElementMissing, steps: menuSteps() }, 2);
    await removeMenu(menu);

    expect(onElementMissing).toHaveBeenCalledTimes(1);
    expect(d.getActiveIndex()).toBe(2);
  });

  it("don't go back while advanceDelay runs", async () => {
    const { menu } = addMenu();
    const d = await start({ onElementMissing: "previousAction", steps: menuSteps({ advanceDelay: 100 }) }, 2);

    d.advance();
    await removeMenu(menu);
    expect(d.getActiveIndex()).toBe(2);

    await tick(150);
    expect(d.isActive()).toBe(false);
  });

  it.each(["previous", "previousAction"] as const)(
    '"%s" keeps the current step when the next element never shows up',
    async onElementMissing => {
      addMenu();
      document.querySelector("#menu")!.remove();
      const d = await start({ onElementMissing, steps: menuSteps().map(step => ({ ...step, waitForElement: 40 })) });

      d.advance();
      await tick(0);
      expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(true);

      await tick(80);
      expect(d.getActiveIndex()).toBe(0);
      expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);

      const menu = append("menu", "div");
      menu.innerHTML = `<p id="menu-info">Info</p>`;
      d.advance();
      await tick(20);
      await nextFrame();
      expect(d.getActiveIndex()).toBe(1);
    }
  );

  it('"stay" falls back to the step without its element after a timeout', async () => {
    addMenu();
    document.querySelector("#menu")!.remove();
    const d = await start({ steps: menuSteps().map(step => ({ ...step, waitForElement: 40 })) });

    d.advance();
    await tick(80);
    await nextFrame();

    expect(d.getActiveIndex()).toBe(1);
    expect(d.getActiveElement()?.id).toBe("driver-dummy-element");
  });

  it("presets fall back as usual when the very first element never shows up", async () => {
    const d = createDriver({
      animate: false,
      onElementMissing: "previousAction",
      steps: [{ element: "#never", waitForElement: 30, popover: { title: "Never" } }],
    });
    d.drive();
    await tick(60);
    await nextFrame();

    expect(d.getActiveIndex()).toBe(0);
    expect(popoverEl()?.classList.contains("driver-popover-waiting")).toBe(false);
    expect(d.getActiveElement()?.id).toBe("driver-dummy-element");
  });
});

describe("warnings", () => {
  const blocked = (advanceOn: AdvanceOn, disableActiveInteraction: boolean | "clicks" = "clicks") =>
    withFirst({ ...SAMPLE_STEPS[0], advanceOn, disableActiveInteraction });

  it("warns once when disableActiveInteraction blocks every advanceOn event", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = await start({ steps: blocked(["click", "dblclick"]) });
    d.moveNext();
    await nextFrame();
    d.movePrevious();
    await nextFrame();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      "[driver.js] Step 1 can't complete: disableActiveInteraction blocks its advanceOn events."
    );
  });

  it("names a highlight() in the warning", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const d = createDriver({ animate: false });
    d.highlight({ ...SAMPLE_STEPS[0], advanceOn: "click", disableActiveInteraction: true });
    await nextFrame();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain("[driver.js] The highlight");
  });

  it.each([[["click", "input"]], ["input"], ["mouseover"]])("stays quiet when %j can still fire", async advanceOn => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await start({ steps: blocked(advanceOn as AdvanceOn, true) });

    expect(warn).not.toHaveBeenCalled();
  });

  it("no longer warns about an action step without advanceOn", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await start({ steps: withFirst(actionStep()) });

    expect(warn).not.toHaveBeenCalled();
  });

  it("stays quiet otherwise", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await start({ steps: withFirst(actionStep("click")) });

    expect(warn).not.toHaveBeenCalled();
  });
});

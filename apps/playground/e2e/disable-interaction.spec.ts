import { expect, test, type Page } from "@playwright/test";
import {
  activeIndex,
  box,
  clearLog,
  log,
  openFixture,
  overlay,
  popover,
  record,
  settle,
  title,
  topElementAt,
} from "./harness";

const PRESS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
const HOVER = ["mouseover", "mouseenter", "pointermove"];
const CLICKS = [...PRESS, "dblclick", "contextmenu", "auxclick"];

type Fired = { type: string; prevented: boolean };

async function trackEvents(page: Page, types: string[]) {
  await page.evaluate(types => {
    const events: Event[] = [];
    for (const type of types) {
      window.addEventListener(type, event => events.push(event), true);
    }

    Object.assign(window, {
      takeEvents: () => events.splice(0).map(event => ({ type: event.type, prevented: event.defaultPrevented })),
    });
  }, types);
}

const takeEvents = (page: Page) =>
  page.evaluate(() => (window as unknown as { takeEvents: () => Fired[] }).takeEvents());

async function center(page: Page, selector: string) {
  const rect = await box(page.locator(selector));

  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe('disableActiveInteraction: "clicks"', () => {
  test("keeps hover, blocks presses and clicks on the element and its children, and still reports them", async ({
    page,
  }) => {
    await trackEvents(page, CLICKS);
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML =
        `<div id="card" style="display:inline-block;padding:24px"><span id="inner">Inner</span></div>`;
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        onInteraction: (_element, _step, opts) => {
          window.log.push(`interaction ${opts.event.type} ${opts.region}`);
        },
        steps: [
          {
            element: "#card",
            disableActiveInteraction: "clicks",
            allowedElements: "#side",
            popover: { title: "Card" },
          },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#card", HOVER);

    const inner = await center(page, "#inner");
    await expect.poll(() => topElementAt(page, inner.x, inner.y)).toBe("inner");
    await page.locator("#inner").hover();
    expect(new Set(await log(page))).toEqual(new Set(["mouseover@#card", "mouseenter@#card", "pointermove@#card"]));

    await clearLog(page);
    await takeEvents(page);
    await record(page, "#card", CLICKS);
    await record(page, null, CLICKS);
    await record(page, "#side-btn", ["mousedown", "click"]);
    await page.locator("#card").click({ position: { x: 4, y: 4 } });
    await page.locator("#inner").dblclick();
    await page.locator("#inner").click({ button: "right" });
    await page.locator("#card").click({ button: "middle", position: { x: 4, y: 4 } });
    await settle(page);

    expect((await log(page)).filter(entry => !HOVER.some(type => entry.startsWith(type)))).toEqual([
      "interaction click element",
      "interaction click element",
      "interaction click element",
      "interaction dblclick element",
      "interaction contextmenu element",
      "interaction auxclick element",
    ]);
    const fired = await takeEvents(page);
    expect(fired.map(event => event.type)).toEqual(expect.arrayContaining(["pointerdown", "click", "contextmenu"]));
    expect(fired.filter(event => !event.prevented)).toEqual([]);

    await clearLog(page);
    await page.locator("#side-btn").click();
    expect((await log(page)).filter(entry => !entry.endsWith("@document"))).toEqual([
      "mousedown@#side-btn",
      "interaction click allowed",
      "click@#side-btn",
    ]);
  });

  test("can be set for the whole tour, turned off by a step, and still advances on hover", async ({ page }) => {
    const one = await center(page, "#one");
    await page.mouse.move(one.x, one.y);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        disableActiveInteraction: "clicks",
        steps: [
          { element: "#one", advanceOn: "mouseover", popover: { title: "One" } },
          { element: "#two", disableActiveInteraction: false, popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#one", ["click"]);
    await record(page, "#two", ["click"]);
    await settle(page);

    await page.mouse.down();
    await page.mouse.up();
    await settle(page);
    expect(await log(page)).toEqual([]);
    expect(await activeIndex(page)).toBe(0);

    await page.mouse.move(5, 5);
    await page.mouse.move(one.x, one.y);
    await expect(title(page)).toHaveText("Two");

    await page.locator("#two").click();
    expect(await log(page)).toEqual(["click@#two"]);
  });
});

test.describe("disableActiveInteraction: true", () => {
  test("blocks the click a keyboard makes, still reports it, and leaves other keys alone", async ({ page }) => {
    await trackEvents(page, ["click"]);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        disableActiveInteraction: true,
        onInteraction: (_element, _step, opts) => {
          window.log.push(`interaction ${opts.event.type} ${opts.region}`);
        },
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "One" } },
          { element: "#field", popover: { title: "Field" } },
          { element: "#two", disableActiveInteraction: false, popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, null, ["click", "keydown", "keyup", "input"]);

    await page.locator("#one").focus();
    await page.keyboard.press("Enter");
    await settle(page);
    expect(await log(page)).toEqual(["keydown@document", "interaction click element", "keyup@document"]);
    expect(await takeEvents(page)).toEqual([{ type: "click", prevented: true }]);
    expect(await activeIndex(page)).toBe(0);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Field");
    await clearLog(page);
    await page.locator("#field").focus();
    await page.keyboard.type("ab");
    await expect(page.locator("#field")).toHaveValue("ab");
    expect((await log(page)).filter(entry => entry !== "keyup@document")).toEqual([
      "keydown@document",
      "input@document",
      "keydown@document",
      "input@document",
    ]);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Two");
    await clearLog(page);
    await page.locator("#two").focus();
    await page.keyboard.press("Enter");
    expect(await log(page)).toEqual([
      "keydown@document",
      "interaction click element",
      "click@document",
      "keyup@document",
    ]);
  });
});

test.describe("disableActiveInteraction modes", () => {
  const start = async (page: import("@playwright/test").Page, value: boolean | "clicks") => {
    await page.evaluate(value => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", disableActiveInteraction: value, popover: { title: "One" } }],
      });
      window.tour.drive();
    }, value);
    await expect(overlay(page)).toHaveCount(1);
  };

  test("true blocks hover and clicks", async ({ page }) => {
    await start(page, true);
    await record(page, "#one", ["mouseenter", "mousedown", "click"]);
    await page.locator("#one").hover({ force: true });
    await page.locator("#one").click({ force: true });
    await settle(page);

    expect(await log(page)).toEqual([]);
    await expect(popover(page)).toHaveCount(1);
  });

  test('"clicks" keeps hover and blocks clicks, right-clicks and double-clicks', async ({ page }) => {
    await start(page, "clicks");
    await record(page, "#one", ["mouseenter", "mousedown", "mouseup", "click", "dblclick", "contextmenu"]);
    await page.locator("#one").hover();
    await page.locator("#one").click();
    await page.locator("#one").dblclick();
    await page.locator("#one").click({ button: "right" });
    await settle(page);

    expect(await log(page)).toEqual(["mouseenter@#one"]);
  });

  test('"clicks" blocks Enter and Space on the focused element', async ({ page }) => {
    await start(page, "clicks");
    await record(page, "#one", ["click"]);
    await page.locator("#one").focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await settle(page);

    expect(await log(page)).toEqual([]);
  });

  test("false leaves the element fully interactive", async ({ page }) => {
    await start(page, false);
    await record(page, "#one", ["mouseenter", "click"]);
    await page.locator("#one").click();
    await page.locator("#one").focus();
    await page.keyboard.press("Enter");
    await settle(page);

    expect(await log(page)).toEqual(["mouseenter@#one", "click@#one", "click@#one"]);
  });
});

test.describe("disableActiveInteraction: true with focus already on the element", () => {
  test("blocks Enter and Space on an element that already has focus", async ({ page }) => {
    await page.locator("#one").focus();
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#one", disableActiveInteraction: true, popover: { showButtons: [] } }],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#one", ["click"]);
    await page.locator("#one").focus();
    await expect(page.locator("#one")).toBeFocused();

    await page.keyboard.press("Enter");
    await page.keyboard.press("Space");
    await settle(page);
    expect(await log(page)).toEqual([]);

    await page.evaluate(() => window.tour.destroy());
    await page.locator("#one").focus();
    await page.keyboard.press("Enter");
    expect(await log(page)).toEqual(["click@#one"]);
  });
});

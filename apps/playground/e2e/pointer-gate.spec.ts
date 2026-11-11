import { expect, test, type Page } from "@playwright/test";
import { box, clearLog, log, nextButton, openFixture, overlay, settle, title, topElementAt } from "./harness";

const PRESS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"];
const CLICKS = [...PRESS, "dblclick", "contextmenu", "auxclick"];

async function listenOnPage(page: Page, types: string[]) {
  await page.evaluate(types => {
    for (const type of types) {
      window.addEventListener(type, () => window.log.push(`window ${type}`), true);
      document.addEventListener(type, () => window.log.push(`document ${type}`));
    }
  }, types);
}

const onPage = (types: string[]) => types.flatMap(type => [`window ${type}`, `document ${type}`]);

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

test.describe("presses that fall through to the page", () => {
  test("are swallowed on <body> and <html>, reported once as outside, and stop being swallowed on destroy", async ({
    page,
  }) => {
    await trackEvents(page, CLICKS);
    await page.evaluate(() => {
      document.body.style.marginTop = "80px";
      const slot = document.querySelector("#slot")!;
      slot.innerHTML = `<div id="menu"><button id="rename" type="button">Rename</button></div>`;
      const menu = slot.querySelector("#menu")!;

      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        disableActiveInteraction: true,
        onInteraction: (_element, _step, opts) => {
          window.log.push(`interaction ${opts.event.type} ${opts.region}`);
        },
        steps: [
          { element: "#rename", popover: { title: "Rename" } },
          { element: "#side", popover: { title: "Side" } },
        ],
      });
      window.tour.drive();

      window.addEventListener(
        "mousedown",
        event => {
          if (!menu.contains(event.target as Node)) {
            menu.remove();
          }
        },
        true
      );
    });
    await expect(overlay(page)).toHaveCount(1);
    await listenOnPage(page, CLICKS);

    const rename = await center(page, "#rename");
    await expect.poll(() => topElementAt(page, rename.x, rename.y)).toBe("body");
    await page.mouse.click(rename.x, rename.y);
    await settle(page);
    expect(await log(page)).toEqual(["interaction click outside"]);
    await expect(page.locator("#menu")).toBeAttached();
    const press = await takeEvents(page);
    expect(press.map(event => event.type)).toEqual(expect.arrayContaining(["pointerdown", "pointerup", "click"]));
    expect(press.filter(event => !event.prevented)).toEqual([]);

    await clearLog(page);
    await page.mouse.dblclick(rename.x, rename.y);
    await page.mouse.click(rename.x, rename.y, { button: "right" });
    await settle(page);
    expect(await log(page)).toEqual([
      "interaction click outside",
      "interaction click outside",
      "interaction dblclick outside",
      "interaction contextmenu outside",
    ]);
    const contextmenu = (await takeEvents(page)).filter(event => event.type === "contextmenu");
    expect(contextmenu).toEqual([{ type: "contextmenu", prevented: false }]);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Side");
    await clearLog(page);
    const side = await center(page, "#side");
    await expect.poll(() => topElementAt(page, side.x, side.y)).toBe("html");
    await page.mouse.click(side.x, side.y);
    await settle(page);
    expect(await log(page)).toEqual(["interaction click outside"]);

    await page.evaluate(() => window.tour.destroy());
    await clearLog(page);
    await page.mouse.click(side.x, side.y);
    expect(await log(page)).toEqual(onPage(PRESS));
  });

  test("leave a press that starts on the highlighted element and ends on the page alone", async ({ page }) => {
    await trackEvents(page, PRESS);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        stagePadding: 30,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", popover: { title: "One", side: "bottom" } }],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await listenOnPage(page, PRESS);

    const one = await box(page.locator("#one"));
    const y = one.y + one.height / 2;
    await expect.poll(() => topElementAt(page, one.x - 15, y)).toBe("body");
    await page.mouse.move(one.x + 5, y);
    await page.mouse.down();
    await page.mouse.move(one.x - 15, y);
    await page.mouse.up();
    await settle(page);

    const fired = await takeEvents(page);
    expect(fired.map(event => event.type)).toEqual(
      expect.arrayContaining(["pointerdown", "mousedown", "pointerup", "mouseup"])
    );
    expect(fired.filter(event => event.prevented)).toEqual([]);
    expect(await log(page)).toEqual(onPage(fired.map(event => event.type)));
  });

  test.describe("with touch", () => {
    test.use({ hasTouch: true });

    test("stop touches without canceling them", async ({ page }) => {
      await trackEvents(page, ["touchstart", "touchend"]);
      await page.evaluate(() => {
        window.tour = window.driverjs.driver({
          animate: false,
          overlayClickBehavior: "none",
          steps: [{ element: "#one", disableActiveInteraction: true, popover: { title: "One" } }],
        });
        window.tour.drive();
      });
      await expect(overlay(page)).toHaveCount(1);
      await listenOnPage(page, ["touchstart", "touchend"]);

      const one = await center(page, "#one");
      await expect.poll(() => topElementAt(page, one.x, one.y)).toBe("body");
      await page.touchscreen.tap(one.x, one.y);
      await settle(page);

      expect(await log(page)).toEqual([]);
      expect(await takeEvents(page)).toEqual([
        { type: "touchstart", prevented: false },
        { type: "touchend", prevented: false },
      ]);

      await page.evaluate(() => window.tour.destroy());
      await page.touchscreen.tap(one.x, one.y);
      expect(await log(page)).toEqual(onPage(["touchstart", "touchend"]));
    });
  });
});

test.describe("presses on the overlay", () => {
  test("never reach listeners added during the tour, not even capturing ones on window", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", popover: { title: "One" } }],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await listenOnPage(page, ["pointerdown", "mousedown", "pointerup", "mouseup"]);

    expect(await topElementAt(page, 5, 5)).toBe("overlay");
    await page.mouse.click(5, 5);
    await page.mouse.click(600, 600);
    await settle(page);

    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("One");

    await page.evaluate(() => window.tour.destroy());
    await page.mouse.click(600, 600);
    expect(await log(page)).toEqual(onPage(["pointerdown", "mousedown", "pointerup", "mouseup"]));
  });
});

test.describe("presses on live targets", () => {
  test("reach the page from the highlighted element, allowed elements and the popover", async ({ page }) => {
    await trackEvents(page, PRESS);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [
          { element: "#one", allowedElements: "#side", popover: { title: "One", description: "About one" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await listenOnPage(page, PRESS);

    await page.locator("#one").click();
    expect(await log(page)).toEqual(onPage(PRESS));

    await clearLog(page);
    await page.locator("#side-btn").click();
    expect(await log(page)).toEqual(onPage(PRESS));
    expect((await takeEvents(page)).filter(event => event.prevented)).toEqual([]);

    await clearLog(page);
    await page.locator(".driver-popover-description").click();
    expect((await log(page)).filter(entry => entry.endsWith(" mousedown"))).toEqual(onPage(["mousedown"]));

    await clearLog(page);
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Two");
    expect((await log(page)).filter(entry => entry.endsWith(" pointerdown"))).toEqual(["window pointerdown"]);
  });

  test("keep advanceOn working on the highlighted element after a press on the page root", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        stagePadding: 30,
        overlayClickBehavior: "none",
        steps: [
          { element: "#one", advanceOn: "mousedown", popover: { title: "One", side: "bottom" } },
          { element: "#two", advanceOn: "click", popover: { title: "Two", side: "bottom" } },
          { element: "#intro", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    const one = await box(page.locator("#one"));
    await expect.poll(() => topElementAt(page, one.x + 5, one.y - 15)).toBe("body");
    await page.mouse.click(one.x + 5, one.y - 15);
    await settle(page);
    await expect(title(page)).toHaveText("One");

    await page.mouse.move(one.x + 5, one.y + 5);
    await page.mouse.down();
    await expect(title(page)).toHaveText("Two");
    await page.mouse.up();

    const two = await box(page.locator("#two"));
    await expect.poll(() => topElementAt(page, two.x + 5, two.y - 15)).toBe("body");
    await page.mouse.click(two.x + 5, two.y - 15);
    await settle(page);
    await expect(title(page)).toHaveText("Two");

    await page.locator("#two").click();
    await expect(title(page)).toHaveText("Three");
  });
});

test.describe("presses that fall through", () => {
  test("never reach body-level listeners, while the element's own do", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", disableActiveInteraction: true, popover: { title: "One" } }],
      });
      window.tour.drive();
      for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
        document.body.addEventListener(type, () => window.log.push(`body ${type}`));
        document.addEventListener(type, () => window.log.push(`document ${type}`));
      }
    });

    await page.locator("#one").click({ force: true });
    await page.mouse.click(600, 600);
    await settle(page);
    expect(await log(page)).toEqual([]);

    await page.evaluate(() => window.tour.destroy());
    await page.locator("#one").click();
    expect(await log(page)).toContain("body click");
  });
});

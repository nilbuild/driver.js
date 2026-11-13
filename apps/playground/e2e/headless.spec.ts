import { expect, test, type Page } from "@playwright/test";
import { activeIndex, clearLog, isActive, log, openFixture, record, settle } from "./harness";

const pageState = (page: Page) =>
  page.evaluate(() => ({
    fixture: document.querySelector("#fixture")!.outerHTML,
    root: document.documentElement
      .getAttributeNames()
      .map(name => `${name}=${document.documentElement.getAttribute(name)}`),
    body: document.body.getAttributeNames().map(name => `${name}=${document.body.getAttribute(name)}`),
    children: Array.from(document.body.children)
      .map(child => child.tagName)
      .filter(tag => tag !== "ASTRO-DEV-TOOLBAR"),
    scrollY: window.scrollY,
  }));

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test("draws nothing, marks nothing and never scrolls", async ({ page }) => {
  const before = await pageState(page);
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({
      allowScroll: false,
      disableActiveInteraction: true,
      allowedElements: "#side",
      steps: [
        { element: "#one", popover: { title: "One" } },
        { element: "#far", popover: { title: "Far" } },
        { popover: { title: "No element" } },
      ],
    });
    window.tour.drive();
  });
  await settle(page);
  expect(await pageState(page)).toEqual(before);

  await page.evaluate(() => window.tour.moveNext());
  await settle(page);
  expect(await page.evaluate(() => window.tour.getActiveElement()?.id)).toBe("far");
  expect(await pageState(page)).toEqual(before);

  await page.evaluate(() => window.tour.moveNext());
  await settle(page);
  expect(await pageState(page)).toEqual(before);

  await page.evaluate(() => window.tour.destroy());
  expect(await pageState(page)).toEqual(before);
});

test("lets every click through, on the target and off it", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({
      disableActiveInteraction: true,
      steps: [
        { element: "#one", advanceOn: "click" },
        { element: "#two", advanceOn: "dblclick" },
      ],
    });
    window.tour.drive();
  });
  await settle(page);
  await record(page, "#outside", ["click"]);
  await record(page, "#one", ["click"]);
  await record(page, null, ["click"]);

  await page.locator("#outside").click();
  await page.mouse.click(5, 5);
  expect(await log(page)).toEqual(["click@#outside", "click@document", "click@document"]);
  expect(await activeIndex(page)).toBe(0);

  await clearLog(page);
  await page.locator("#one").click();
  await expect.poll(() => activeIndex(page)).toBe(1);
  expect(await log(page)).toEqual(["click@#one", "click@document"]);

  await page.locator("#two").click();
  await settle(page);
  expect(await activeIndex(page)).toBe(1);
});

test("still holds back the wrong gesture on a strict step", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({
      steps: [{ element: "#two", advanceOn: { event: "dblclick", strict: true } }, { element: "#intro" }],
    });
    window.tour.drive();
  });
  await settle(page);
  await record(page, "#two", ["contextmenu", "dblclick"]);

  await page.locator("#two").click({ button: "right" });
  await settle(page);
  expect(await log(page)).toEqual([]);
  expect(await activeIndex(page)).toBe(0);

  await page.locator("#two").dblclick();
  await expect.poll(() => activeIndex(page)).toBe(1);
  expect(await log(page)).toEqual(["dblclick@#two"]);
});

test("reports clicks to onInteraction and lets it veto them", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({
      onInteraction: (_element, _step, opts) => {
        window.log.push(`interaction ${opts.region}`);
        return opts.region === "outside" ? false : undefined;
      },
      steps: [{ element: "#one", advanceOn: "click" }, { element: "#two" }],
    });
    window.tour.drive();
  });
  await settle(page);
  await record(page, "#outside", ["click"]);

  await page.locator("#outside").click();
  expect(await log(page)).toEqual(["interaction outside"]);

  await clearLog(page);
  await page.locator("#one").click();
  await expect.poll(() => activeIndex(page)).toBe(1);
  expect(await log(page)).toEqual(["interaction element"]);
});

test("follows a target the app redraws", async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `<button id="row" type="button">Row</button>`;
    window.tour = window.driverjs.headless({
      steps: [{ element: "#row", advanceOn: "click" }, { element: "#intro" }],
    });
    window.tour.drive();
  });
  await settle(page);

  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `<button id="row" type="button">Row again</button>`;
  });
  await expect.poll(() => page.evaluate(() => window.tour.getActiveElement()?.textContent)).toBe("Row again");

  await page.locator("#row").click();
  await expect.poll(() => activeIndex(page)).toBe(1);
});

test("leaves the keyboard alone", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({ steps: [{ element: "#one" }, { element: "#two" }] });
    window.tour.drive();
  });
  await settle(page);

  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await settle(page);

  expect(await isActive(page)).toBe(true);
  expect(await activeIndex(page)).toBe(0);
});

test("reports a wait for an element and its end", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.headless({
      waitForElement: 3000,
      onWaitingForElement: (_element, _step, opts) => {
        window.log.push(`waiting ${opts.index}`);
        opts.signal.addEventListener("abort", () => window.log.push("done waiting"));
      },
      onDestroyed: () => window.log.push("destroyed"),
      steps: [{ element: "#late" }],
    });
    window.tour.drive();
  });
  expect(await log(page)).toEqual(["waiting 0"]);
  expect(await activeIndex(page)).toBe(0);

  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `<button id="late" type="button">Late</button>`;
  });
  await expect.poll(() => page.evaluate(() => window.tour.getActiveElement()?.id)).toBe("late");
  expect(await log(page)).toEqual(["waiting 0", "done waiting"]);

  await page.evaluate(() => window.tour.destroy());
  expect(await log(page)).toEqual(["waiting 0", "done waiting", "destroyed"]);
});

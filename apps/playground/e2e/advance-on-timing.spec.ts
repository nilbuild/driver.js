import { expect, test, type Page } from "@playwright/test";
import type { Config } from "driver.js";
import { activeIndex, isActive, log, openFixture, overlay, record, settle, title } from "./harness";

const STEPS = [
  { element: "#one", popover: { title: "Step 1" } },
  { element: "#two", popover: { title: "Step 2" } },
  { element: "#three", popover: { title: "Step 3" } },
];

async function start(page: Page, config: Config = {}, index = 0) {
  await page.evaluate(
    ({ config, index }) => {
      window.tour?.destroy();
      window.tour = window.driverjs.driver({ animate: false, ...(config as Config) });
      window.tour.drive(index);
    },
    { config: { steps: STEPS, ...config } as object, index }
  );
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

const rightClick = (page: Page, selector: string) => page.locator(selector).click({ button: "right" });

async function expectStill(page: Page, index: number) {
  await settle(page);
  expect(await activeIndex(page)).toBe(index);
  expect(await isActive(page)).toBe(true);
}

const highlighted = (page: Page, count: number) =>
  page.waitForFunction(count => window.log.filter(entry => entry.startsWith("highlighted")).length === count, count);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => document.addEventListener("contextmenu", event => event.preventDefault()));
});

test.describe("advanceOn while the highlight is moving", () => {
  test("completes on a gesture or on typing before the transition has finished", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        duration: 3000,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#one", popover: { title: "Step 1" } },
          { element: "#one", advanceOn: "contextmenu", popover: { title: "Step 2" } },
          { element: "#field", advanceOn: "input", popover: { title: "Step 3" } },
          { element: "#three", popover: { title: "Step 4" } },
        ],
      });
      window.tour.drive();
      window.tour.moveNext();
    });
    await expect(overlay(page)).toHaveCount(1);

    await rightClick(page, "#one");
    await expect.poll(() => activeIndex(page)).toBe(2);

    await page.evaluate(() => document.querySelector<HTMLInputElement>("#field")!.focus());
    await page.keyboard.type("a");
    await expect.poll(() => activeIndex(page)).toBe(3);
    expect(await log(page)).toEqual([]);
    await expect(page.locator("#field")).toHaveValue("a");
  });

  test("takes a new click on the next step right away", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        duration: 3000,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", advanceOn: "click", popover: { title: "Step 1" } },
          { element: "#intro", advanceOn: "click", popover: { title: "Step 2" } },
          { element: "#three", popover: { title: "Step 3" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await page.locator("#intro").click({ position: { x: 5, y: 5 } });
    await page.locator("#intro").click({ position: { x: 60, y: 10 } });
    await expect.poll(() => activeIndex(page)).toBe(2);
    expect(await log(page)).toEqual([]);
  });

  test("the deprecated advanceOnClick ignores every click until the transition has finished", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        duration: 2000,
        advanceOnClick: true,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#one", popover: { title: "Step 1" } },
          { element: "#one", popover: { title: "Step 2" } },
          { element: "#one", popover: { title: "Step 3" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await page.locator("#one").click();
    await settle(page);
    expect(await page.evaluate(() => `${window.tour.getActiveIndex()} ${window.log.join()}`)).toBe("0 ");

    await highlighted(page, 1);
    await page.locator("#one").dblclick();
    await expectStill(page, 1);
    await expect(title(page)).toHaveText("Step 2");
  });
});

test.describe("advanceOn and double-clicks", () => {
  for (const animate of [true, false]) {
    test(`a fast double-click does not skip a step that advances on click (animate: ${animate})`, async ({ page }) => {
      await page.evaluate(animate => {
        window.tour = window.driverjs.driver({
          animate,
          duration: 60,
          advanceOn: "click",
          onHighlighted: (_element, step) => {
            window.log.push(`highlighted ${step.popover?.title}`);
          },
          steps: [
            { element: "#one", popover: { title: "Step 1" } },
            { element: "#one", popover: { title: "Step 2" } },
            { element: "#three", popover: { title: "Step 3" } },
          ],
        });
        window.tour.drive();
      }, animate);
      await highlighted(page, 1);

      await page.locator("#one").dblclick();
      await highlighted(page, 2);
      await expectStill(page, 1);
      await expect(title(page)).toHaveText("Step 2");

      await page.locator("#one").click();
      await expect(title(page)).toHaveText("Step 3");
    });
  }

  test("a double-click on the next step's element right after a click counts", async ({ page }) => {
    await start(page, {
      steps: [
        { element: "#one", advanceOn: "click", popover: { title: "Step 1" } },
        { element: "#three", advanceOn: "dblclick", popover: { title: "Step 2" } },
        { element: "#intro", popover: { title: "Step 3" } },
      ],
    });

    await page.locator("#one").click();
    await page.locator("#three").dblclick();
    await expect(title(page)).toHaveText("Step 3");
  });
});

test.describe("advanceOn and elements that come and go", () => {
  test("completes once while the next step is waiting for its element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", advanceOn: "contextmenu", popover: { title: "Step 1" } },
          {
            element: "#late",
            waitForElement: 5000,
            onHighlighted: () => {
              window.log.push("highlighted Late");
            },
            popover: { title: "Late" },
          },
          { element: "#three", popover: { title: "Step 3" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");
    await settle(page);
    await record(page, "#one", ["contextmenu"]);

    await rightClick(page, "#one");
    await rightClick(page, "#one");
    await rightClick(page, "#one");
    expect(await log(page)).toEqual(["contextmenu@#one", "contextmenu@#one", "contextmenu@#one"]);

    await page.evaluate(() => {
      window.log.splice(0);
      document.querySelector("#slot")!.innerHTML = `<button id="late" type="button">Late</button>`;
    });
    await expect(title(page)).toHaveText("Late");
    await expectStill(page, 1);
    expect(await log(page)).toEqual(["highlighted Late"]);
  });

  test("follows an element the app re-rendered", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<input id="temp" type="text" />`;
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => {
          window.log.push("missing");
        },
        steps: [
          {
            element: "#temp",
            advanceOn: {
              event: "keydown",
              when: (_element, _step, opts) => (opts.event as KeyboardEvent).key === "ArrowDown",
            },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");

    await page.evaluate(() => {
      document.querySelector("#temp")!.remove();
      document.querySelector("#slot")!.innerHTML = `<input id="temp" type="text" />`;
    });
    await expect(page.locator("#temp")).toHaveClass(/driver-active-element/);

    await page.locator("#temp").click();
    await page.keyboard.type("a");
    await expectStill(page, 0);
    await page.keyboard.press("ArrowDown");
    await expect(title(page)).toHaveText("Step 2");
    expect(await log(page)).toEqual([]);
  });
});

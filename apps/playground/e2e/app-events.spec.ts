import { expect, test, type Page } from "@playwright/test";
import { box, log, nextButton, openFixture, overlay, record, settle, title } from "./harness";

async function center(page: Page, selector: string) {
  const rect = await box(page.locator(selector));

  return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("events the app dispatches itself", () => {
  for (const value of [true, "clicks"] as const) {
    test(`pass a disableActiveInteraction: ${JSON.stringify(value)} element and reach the page after real presses`, async ({
      page,
    }) => {
      await page.evaluate(value => {
        window.tour = window.driverjs.driver({
          animate: false,
          overlayClickBehavior: "none",
          steps: [{ element: "#one", disableActiveInteraction: value, popover: { title: "One" } }],
        });
        window.tour.drive();
        document.body.addEventListener("click", event => {
          if (event.target === document.body) {
            window.log.push("click@body");
          }
        });
      }, value);
      await expect(overlay(page)).toHaveCount(1);
      await record(page, "#one", ["click"]);
      await record(page, null, ["click"]);

      const one = await center(page, "#one");
      await page.mouse.click(one.x, one.y);
      await page.mouse.click(5, 5);
      await settle(page);
      expect(await log(page)).toEqual([]);

      const passed = await page.evaluate(() => {
        const one = document.querySelector<HTMLElement>("#one")!;
        one.click();
        const click = one.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true }));
        document.body.click();
        const press = document.body.dispatchEvent(
          new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true })
        );

        return { click, press };
      });

      expect(passed).toEqual({ click: true, press: true });
      expect(await log(page)).toEqual([
        "click@#one",
        "click@document",
        "click@#one",
        "click@document",
        "click@body",
        "click@document",
      ]);
    });
  }

  test("are still reported to onInteraction, which can block them, and still complete advanceOn", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#one",
            popover: { title: "One" },
            onInteraction: (_element, _step, opts) => {
              window.log.push(`interaction ${opts.event.type} ${opts.region}`);

              return false;
            },
          },
          { element: "#two", advanceOn: "click", popover: { title: "Two" } },
          { element: "#intro", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#one", ["click"]);

    await page.evaluate(() => document.querySelector<HTMLElement>("#one")!.click());
    expect(await log(page)).toEqual(["interaction click element"]);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Two");
    await page.evaluate(() => document.querySelector<HTMLElement>("#two")!.click());
    await expect(title(page)).toHaveText("Three");
  });
});

test.describe("events the app dispatches from hooks and after overlay presses", () => {
  test("a hook can click a disableActiveInteraction element before moving on", async ({ page }) => {
    await record(page, "#one", ["click"]);
    await record(page, null, ["click"]);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#one",
            disableActiveInteraction: true,
            popover: {
              title: "One",
              onNextClick: element => {
                (element as HTMLElement).click();
                window.tour.moveNext();
              },
            },
          },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });

    await nextButton(page).click();
    await expect(title(page)).toHaveText("Two");
    expect(await log(page)).toEqual(["click@#one", "click@document"]);
  });

  test("document.body.click() reaches the page after a press on the overlay", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "nextStep",
        onNextClick: () => {
          document.body.click();
          window.tour.moveNext();
        },
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
      document.body.addEventListener("click", () => window.log.push("body click"));
    });

    await expect(overlay(page)).toHaveCount(1);
    await page.mouse.click(600, 600);
    await expect(title(page)).toHaveText("Two");
    expect(await log(page)).toEqual(["body click"]);
  });
});

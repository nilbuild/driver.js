import { expect, test, type Page } from "@playwright/test";
import {
  activeIndex,
  box,
  clearLog,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  record,
  settle,
  title,
  topElementAt,
} from "./harness";

const setBlocking = (page: Page, mode: "all" | "element clicks" | "nothing") =>
  page.evaluate(mode => {
    document.documentElement.dataset.block = mode;
  }, mode);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => {
    document.addEventListener("contextmenu", event => event.preventDefault());
    document.addEventListener("mousedown", event => {
      const startsAutoscroll = event.button === 1;
      if (startsAutoscroll) {
        event.preventDefault();
      }
    });
  });
});

test.describe("onInteraction", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      let reported: Event | undefined;
      document.querySelector("#hover")!.addEventListener("click", event => {
        window.log.push(`same event ${event === reported}`);
      });

      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        onInteraction: (element, step, opts) => {
          reported = opts.event;
          const details = [
            (element as HTMLElement).id,
            step.popover?.title,
            opts.event.type,
            opts.region,
            opts.index,
            opts.driver === window.tour,
          ];
          window.log.push(details.join(" "));
        },
        steps: [
          { element: "#hover", allowedElements: "#side", popover: { title: "Hover", description: "About it" } },
          {
            element: "#two",
            popover: { title: "Two" },
            onInteraction: (_element, _step, opts) => {
              window.log.push(`step hook ${opts.event.type}`);
            },
          },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
  });

  test("reports clicks, double-clicks, right-clicks and middle-clicks with the element, step, event and region", async ({
    page,
  }) => {
    await page.locator("#hover").click();
    expect(await log(page)).toEqual(["hover Hover click element 0 true", "same event true"]);

    await clearLog(page);
    const target = await box(page.locator("#hover"));
    expect(await topElementAt(page, 5, 5)).toBe("overlay");
    expect(await topElementAt(page, target.x - 5, target.y + 5)).toBe("body");
    await page.mouse.click(5, 5);
    await page.mouse.click(target.x - 5, target.y + 5);
    await page.locator("#side-btn").click();
    expect(await log(page)).toEqual([
      "hover Hover click outside 0 true",
      "hover Hover click outside 0 true",
      "hover Hover click allowed 0 true",
    ]);

    await clearLog(page);
    await page.locator("#hover").click({ button: "right" });
    await page.locator("#hover").dblclick();
    await page.locator("#hover").click({ button: "middle" });
    await expect
      .poll(async () => (await log(page)).filter(entry => !entry.startsWith("same event")))
      .toEqual([
        "hover Hover contextmenu element 0 true",
        "hover Hover click element 0 true",
        "hover Hover click element 0 true",
        "hover Hover dblclick element 0 true",
        "hover Hover auxclick element 0 true",
      ]);
  });

  test("stays quiet for keys and the popover, prefers a step's own hook, and stops on destroy", async ({ page }) => {
    await page.locator("#hover").focus();
    await page.keyboard.type("a");
    await page.locator(".driver-popover-description").click();
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Two");
    expect(await log(page)).toEqual([]);

    await page.locator("#two").click();
    expect(await log(page)).toEqual(["step hook click"]);

    await page.evaluate(() => window.tour.destroy());
    await page.locator("#two").click();
    expect(await log(page)).toEqual(["step hook click"]);
  });
});

test("onInteraction consumes an event by returning false", async ({ page }) => {
  await page.evaluate(() => {
    const events: Event[] = [];
    window.addEventListener("click", event => events.push(event), true);
    Object.assign(window, { takePrevented: () => events.splice(0).map(event => event.defaultPrevented) });
    document.addEventListener("click", () => window.log.push("click@document capture"), true);

    window.tour = window.driverjs.driver({
      animate: false,
      onInteraction: (_element, _step, opts) => {
        const mode = document.documentElement.dataset.block;
        if (mode === "all") {
          return false;
        }

        if (mode === "element clicks" && opts.region === "element" && opts.event.type === "click") {
          return false;
        }
      },
      steps: [
        { element: "#two", popover: { title: "Two" } },
        { element: "#one", advanceOn: "click", popover: { title: "One" } },
        { element: "#intro", advanceOn: "contextmenu", popover: { title: "Intro" } },
        { element: "#three", popover: { title: "Three" } },
      ],
    });
    window.tour.drive();
  });
  await expect(overlay(page)).toHaveCount(1);
  await record(page, "#two", ["click"]);
  const takePrevented = () =>
    page.evaluate(() => (window as unknown as { takePrevented: () => boolean[] }).takePrevented());

  await page.locator("#two").click();
  expect(await log(page)).toEqual(["click@document capture", "click@#two"]);
  expect(await takePrevented()).toEqual([false]);

  await clearLog(page);
  await setBlocking(page, "all");
  await page.locator("#two").click();
  await page.mouse.click(5, 5);
  await settle(page);
  expect(await log(page)).toEqual([]);
  expect(await takePrevented()).toEqual([true, true]);
  await expect(title(page)).toHaveText("Two");

  await page.evaluate(() => window.tour.moveNext());
  await expect(title(page)).toHaveText("One");
  await page.locator("#one").click();
  await settle(page);
  expect(await activeIndex(page)).toBe(1);

  await setBlocking(page, "element clicks");
  await page.evaluate(() => window.tour.moveNext());
  await expect(title(page)).toHaveText("Intro");
  await page.locator("#intro").click();
  await settle(page);
  expect(await activeIndex(page)).toBe(2);
  await page.locator("#intro").click({ button: "right" });
  await expect(title(page)).toHaveText("Three");

  await setBlocking(page, "nothing");
  await page.mouse.click(5, 5);
  await expect(popover(page)).toHaveCount(0);
});

test.describe("keyboard ownership of the highlighted element", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="panel" style="display:inline-block;padding:12px">
          <input id="panel-field" type="text" />
          <button id="panel-button" type="button">Plain</button>
          <span role="menu"><button id="panel-item" type="button" role="menuitem">Rename</button></span>
        </div>`;
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#panel", popover: { title: "Panel" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await settle(page);
  });

  test("Escape and arrows in a field or a menu inside it belong to the app, on a plain button to the tour", async ({
    page,
  }) => {
    await page.locator("#panel-field").click();
    await page.keyboard.type("ab");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("Escape");
    await page.locator("#panel-item").focus();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("Escape");
    await settle(page);
    await expect(title(page)).toHaveText("Panel");
    await expect(page.locator("#panel-field")).toHaveValue("ab");

    await page.locator("#panel-button").focus();
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Two");

    await page.evaluate(() => window.tour.movePrevious());
    await expect(title(page)).toHaveText("Panel");
    await settle(page);
    await page.locator("#panel-button").focus();
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
  });

  test("a key the app already handled is left alone, and Escape closes with focus outside", async ({ page }) => {
    await page.evaluate(() => {
      (document.activeElement as HTMLElement | null)?.blur();
      document.body.addEventListener(
        "keydown",
        event => {
          window.log.push(`app handled ${event.key}`);
          event.preventDefault();
        },
        { once: true }
      );
    });
    expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

    await page.keyboard.press("Escape");
    await settle(page);
    expect(await log(page)).toEqual(["app handled Escape"]);
    await expect(title(page)).toHaveText("Panel");

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
  });
});

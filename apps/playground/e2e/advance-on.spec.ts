import { expect, test, type Page } from "@playwright/test";
import type { Config, DriveStep } from "driver.js";
import {
  activeIndex,
  isActive,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  record,
  settle,
  title,
} from "./harness";

const STEPS = [
  { element: "#one", popover: { title: "Step 1" } },
  { element: "#two", popover: { title: "Step 2" } },
  { element: "#three", popover: { title: "Step 3" } },
];

const withStep = (index: number, extra: DriveStep) =>
  STEPS.map((step, i) => (i === index ? { ...step, ...extra } : step));

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

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => document.addEventListener("contextmenu", event => event.preventDefault()));
});

test.describe("advanceOn with an event name", () => {
  test("advances on that event only, on the highlighted element only, and leaves the event to the app", async ({
    page,
  }) => {
    await start(page, { steps: withStep(0, { advanceOn: "contextmenu" }) });
    await page.evaluate(() => {
      document.querySelector("#one")!.addEventListener("contextmenu", event => {
        window.log.push(`contextmenu prevented=${event.defaultPrevented}`);
      });
    });

    await page.locator("#one").click();
    await page.locator("#one").dblclick();
    await page.locator("#two").click({ button: "right", force: true });
    await expectStill(page, 0);
    expect(await log(page)).toEqual([]);

    await rightClick(page, "#one");
    await expect(title(page)).toHaveText("Step 2");
    expect(await activeIndex(page)).toBe(1);
    expect(await log(page)).toEqual(["contextmenu prevented=false"]);
  });

  test("advances on an event from a descendant of the highlighted element", async ({ page }) => {
    await start(page, { steps: withStep(0, { element: "#side", advanceOn: "dblclick" }) });

    await page.locator("#side-btn").dblclick();
    await expect(title(page)).toHaveText("Step 2");
  });

  test("takes a list of events, an object, and an object with a list and a condition", async ({ page }) => {
    const forms = [
      ["list", "contextmenu"],
      ["object", "dblclick"],
      ["conditional list", "contextmenu"],
    ] as const;

    for (const [form, gesture] of forms) {
      await page.evaluate(form => {
        const advanceOn: Record<string, DriveStep["advanceOn"]> = {
          list: ["dblclick", "contextmenu"],
          object: { event: "dblclick" },
          "conditional list": { event: ["dblclick", "contextmenu"], when: () => true },
        };
        window.tour?.destroy();
        window.tour = window.driverjs.driver({
          animate: false,
          steps: [
            { element: "#one", advanceOn: advanceOn[form], popover: { title: "Step 1" } },
            { element: "#two", popover: { title: "Step 2" } },
          ],
        });
        window.tour.drive();
      }, form);
      await expect(title(page)).toHaveText("Step 1");
      await settle(page);

      await page.locator("#one").click();
      await expectStill(page, 0);

      await page.locator("#one").click(gesture === "dblclick" ? { clickCount: 2 } : { button: "right" });
      await expect(title(page), form).toHaveText("Step 2");
    }
  });

  test("set in the config applies to every step, and a step can replace it or switch it off", async ({ page }) => {
    await start(page, {
      advanceOn: "dblclick",
      steps: [
        { element: "#one", advanceOn: "contextmenu", popover: { title: "Step 1" } },
        { element: "#two", popover: { title: "Step 2" } },
        { element: "#three", popover: { title: "Step 3" } },
        { element: "#field", advanceOn: false, popover: { title: "Step 4" } },
        { element: "#intro", popover: { title: "Step 5" } },
      ],
    });

    await page.locator("#one").dblclick();
    await expectStill(page, 0);
    await rightClick(page, "#one");
    await expect(title(page)).toHaveText("Step 2");

    await page.locator("#two").dblclick();
    await expect(title(page)).toHaveText("Step 3");
    await page.locator("#three").dblclick();
    await expect(title(page)).toHaveText("Step 4");

    await page.locator("#field").dblclick();
    await expectStill(page, 3);
  });

  test("stops listening once the step is left and after destroy", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onNextClick: () => {
          window.log.push("next");
        },
        steps: [
          { element: "#side-btn", advanceOn: "contextmenu", popover: { title: "Step 1" } },
          { element: "#two", allowedElements: "#side", popover: { title: "Step 2" } },
          { element: "#three", popover: { title: "Step 3" } },
        ],
      });
      window.tour.drive();
      window.tour.moveTo(1);
    });
    await expect(title(page)).toHaveText("Step 2");
    await settle(page);
    await record(page, "#side-btn", ["contextmenu"]);

    await rightClick(page, "#side-btn");
    await expectStill(page, 1);
    expect(await log(page)).toEqual(["contextmenu@#side-btn"]);

    await page.evaluate(() => window.tour.moveTo(0));
    await expect(title(page)).toHaveText("Step 1");
    await page.evaluate(() => window.tour.destroy());
    await rightClick(page, "#side-btn");
    await settle(page);
    expect(await log(page)).toEqual(["contextmenu@#side-btn", "contextmenu@#side-btn"]);
  });

  test("goes through onNextClick every time, in a tour and in highlight()", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onNextClick: (_element, step) => {
          window.log.push(`next ${step.popover?.title}`);
        },
        steps: [
          { element: "#one", advanceOn: "contextmenu", popover: { title: "Step 1" } },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");
    await settle(page);

    await rightClick(page, "#one");
    await expect.poll(() => log(page)).toEqual(["next Step 1"]);
    await expectStill(page, 0);
    await rightClick(page, "#one");
    await expect.poll(() => log(page)).toEqual(["next Step 1", "next Step 1"]);

    await page.evaluate(() => {
      window.tour.destroy();
      window.tour.highlight({ element: "#two", advanceOn: "contextmenu", popover: { title: "Solo" } });
    });
    await expect(title(page)).toHaveText("Solo");
    await settle(page);

    await rightClick(page, "#two");
    await expect.poll(() => log(page)).toEqual(["next Step 1", "next Step 1", "next Solo"]);
  });

  test("on the last step ends the tour as done, or runs onDoneClick", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onDestroyed: (_element, _step, opts) => {
          window.log.push(`destroyed ${opts.reason}`);
        },
        steps: [
          { element: "#one", popover: { title: "Step 1" } },
          { element: "#three", advanceOn: "contextmenu", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Last");
    await settle(page);

    await rightClick(page, "#three");
    await expect(popover(page)).toHaveCount(0);
    expect(await isActive(page)).toBe(false);
    expect(await log(page)).toEqual(["destroyed done"]);

    await page.evaluate(() => {
      window.log.splice(0);
      window.tour = window.driverjs.driver({
        animate: false,
        advanceOnClick: true,
        onDoneClick: () => {
          window.log.push("done");
        },
        steps: [
          { element: "#one", popover: { title: "Step 1" } },
          { element: "#three", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Last");
    await settle(page);

    await page.locator("#three").click();
    await expect.poll(() => log(page)).toEqual(["done"]);
    await expectStill(page, 1);
    expect(await log(page)).toEqual(["done"]);
  });
});

test.describe("advanceOn with a condition", () => {
  test("advances only once the condition holds", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<p id="form"><input id="answer" type="text" /></p>`;
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#form",
            advanceOn: { event: "change", when: element => element.querySelector("input")!.value === "yes" },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");
    await record(page, "#answer", ["change"]);

    await page.locator("#answer").click();
    await page.keyboard.type("no");
    await page.keyboard.press("Enter");
    await expect.poll(() => log(page)).toEqual(["change@#answer"]);
    await expectStill(page, 0);

    await page.keyboard.press("Backspace");
    await page.keyboard.press("Backspace");
    await page.keyboard.type("yes");
    await page.keyboard.press("Enter");
    await expect(title(page)).toHaveText("Step 2");
    await expectStill(page, 1);
  });

  test("gets the element, the step and the options with the event, once per event", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#one",
            advanceOn: {
              event: "click",
              when: (element, step, opts) => {
                window.log.push(
                  [element.id, step.popover?.title, opts.event.type, opts.driver === window.tour, opts.index].join()
                );

                return false;
              },
            },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");
    await settle(page);

    await page.locator("#one").click();
    await expectStill(page, 0);
    expect(await log(page)).toEqual(["one,Step 1,click,true,0"]);
  });

  test("is checked after the app's own handlers", async ({ page }) => {
    await page.evaluate(() => {
      const field = document.querySelector<HTMLInputElement>("#field")!;
      field.addEventListener("keydown", event => {
        if (event.key === "ArrowDown") {
          field.dataset.open = "true";
        }
      });
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#field",
            advanceOn: { event: "keydown", when: () => field.dataset.open === "true" },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");

    await page.locator("#field").click();
    await page.keyboard.type("ab");
    await expectStill(page, 0);

    await page.keyboard.press("ArrowDown");
    await expect(title(page)).toHaveText("Step 2");
    await expectStill(page, 1);
  });

  const startKeyTour = (page: Page, key: string) =>
    page.evaluate(key => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#field",
            advanceOn: {
              event: "keydown",
              when: (_element, _step, opts) => (opts.event as KeyboardEvent).key === key,
            },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
          { element: "#three", popover: { title: "Step 3" } },
        ],
      });
      window.tour.drive();
    }, key);

  for (const [name, key] of [
    ["Enter", "Enter"],
    ["Space", " "],
  ]) {
    test(`completing a step with ${name} does not press a button of the next popover`, async ({ page }) => {
      await startKeyTour(page, key);
      await expect(title(page)).toHaveText("Step 1");

      await page.locator("#field").click();
      await page.keyboard.type("ab");
      await page.keyboard.press(name);
      await expect(title(page)).toHaveText("Step 2");
      await expectStill(page, 1);
    });

    test(`holding ${name} down after it completed a step does nothing more`, async ({ page }) => {
      await startKeyTour(page, key);
      await expect(title(page)).toHaveText("Step 1");

      await page.locator("#field").click();
      await page.keyboard.down(name);
      await expect(title(page)).toHaveText("Step 2");
      for (let repeat = 0; repeat < 5; repeat++) {
        await page.keyboard.down(name);
      }
      await expectStill(page, 1);
      await page.keyboard.up(name);
      await expectStill(page, 1);

      await page.keyboard.press(name);
      await expect(popover(page)).toHaveCount(0);
    });
  }

  test("advance() from the app's own keydown handler does not press a button of the next popover", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({ animate: false, steps: [{ element: "#field" }, {}, {}] });
      document.querySelector("#field")!.addEventListener("keydown", event => {
        if ((event as KeyboardEvent).key === "Enter" && !(event as KeyboardEvent).repeat) {
          window.tour.advance();
        }
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await page.locator("#field").click();
    await page.keyboard.down("Enter");
    await page.keyboard.down("Enter");
    await page.keyboard.up("Enter");
    await expectStill(page, 1);
  });

  test("an arrow key that completed a step does not also move the next one", async ({ page }) => {
    await startKeyTour(page, "ArrowRight");
    await expect(title(page)).toHaveText("Step 1");

    await page.locator("#field").click();
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Step 2");
    await expectStill(page, 1);

    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Step 3");
  });

  test("is not checked for an event that onInteraction blocked", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onInteraction: () => false,
        steps: [
          {
            element: "#one",
            advanceOn: {
              event: "click",
              when: () => {
                window.log.push("checked");

                return true;
              },
            },
            popover: { title: "Step 1" },
          },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Step 1");
    await settle(page);

    await page.locator("#one").click();
    await expectStill(page, 0);
    expect(await log(page)).toEqual([]);
  });
});

test.describe("advanceOnClick", () => {
  test("is off by default and can be switched on for one step", async ({ page }) => {
    await start(page, { steps: withStep(1, { advanceOnClick: true }) });

    await page.locator("#one").click();
    await expectStill(page, 0);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Step 2");
    await page.locator("#two").click();
    await expect(title(page)).toHaveText("Step 3");

    await page.locator("#three").click();
    await expectStill(page, 2);
  });

  test("set in the config advances once per click, and a step can opt out or use advanceOn instead", async ({
    page,
  }) => {
    await start(page, {
      advanceOnClick: true,
      steps: [
        { element: "#one", popover: { title: "Step 1" } },
        { element: "#heading", popover: { title: "Step 2" } },
        { element: "#two", advanceOn: "contextmenu", popover: { title: "Step 3" } },
        { element: "#three", advanceOn: "click", popover: { title: "Step 4" } },
        { element: "#field", advanceOnClick: false, popover: { title: "Step 5" } },
        { element: "#intro", popover: { title: "Step 6" } },
      ],
    });

    await page.locator("#one").click();
    await expect(title(page)).toHaveText("Step 2");
    await expectStill(page, 1);

    await nextButton(page).click();
    await expect(title(page)).toHaveText("Step 3");
    await expectStill(page, 2);

    await page.locator("#two").click();
    await expectStill(page, 2);
    await rightClick(page, "#two");
    await expect(title(page)).toHaveText("Step 4");

    await page.locator("#three").click();
    await expect(title(page)).toHaveText("Step 5");
    await expectStill(page, 4);

    await page.locator("#field").click();
    await expectStill(page, 4);
  });
});

test.describe("advanceOn and what the app does with the event", () => {
  const startWithHandler = async (page: Page, navigates: boolean) => {
    await page.evaluate(navigates => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", advanceOn: "contextmenu", popover: { title: "Step 1" } },
          { element: "#two", popover: { title: "Step 2" } },
          { element: "#three", popover: { title: "Step 3" } },
        ],
      });
      document.querySelector("#one")!.addEventListener("contextmenu", event => {
        event.preventDefault();
        event.stopPropagation();
        if (navigates) {
          window.tour.moveTo(2);
        }
        queueMicrotask(() => window.log.push(`index after the handler ${window.tour.getActiveIndex()}`));
      });
      window.tour.drive();
    }, navigates);
    await expect(title(page)).toHaveText("Step 1");
    await settle(page);
  };

  test("still completes when the app stops propagation", async ({ page }) => {
    await startWithHandler(page, false);

    await rightClick(page, "#one");
    await expect(title(page)).toHaveText("Step 2");
    expect(await log(page)).toEqual(["index after the handler 0"]);
    await expectStill(page, 1);
  });

  test("does not complete on top of the app's own navigation in that handler", async ({ page }) => {
    await startWithHandler(page, true);

    await rightClick(page, "#one");
    await expect(title(page)).toHaveText("Step 3");
    expect(await log(page)).toEqual(["index after the handler 2"]);
    await expectStill(page, 2);
  });
});

test.describe("advanceOn with real gestures", () => {
  const start = async (page: import("@playwright/test").Page, advanceOn: string, element = "#one") => {
    await page.evaluate(
      ({ advanceOn, element }) => {
        window.tour = window.driverjs.driver({
          animate: false,
          steps: [
            { element, advanceOn, popover: { title: "Act" } },
            { element: "#intro", popover: { title: "After" } },
          ],
        });
        window.tour.drive();
      },
      { advanceOn, element }
    );
    await expect(overlay(page)).toHaveCount(1);
  };

  test("click", async ({ page }) => {
    await start(page, "click");
    await record(page, "#one", ["click"]);
    await page.locator("#one").click();
    await expect(title(page)).toHaveText("After");
    expect(await log(page)).toEqual(["click@#one"]);
  });

  test("dblclick needs the second click", async ({ page }) => {
    await start(page, "dblclick");
    await page.locator("#one").click();
    await settle(page);
    await expect(title(page)).toHaveText("Act");
    await page.locator("#one").dblclick();
    await expect(title(page)).toHaveText("After");
  });

  test("contextmenu", async ({ page }) => {
    await start(page, "contextmenu");
    await page.evaluate(() => document.addEventListener("contextmenu", event => event.preventDefault()));
    await page.locator("#one").click({ button: "right" });
    await expect(title(page)).toHaveText("After");
  });

  test("input", async ({ page }) => {
    await start(page, "input", "#field");
    await page.locator("#field").click();
    await settle(page);
    await expect(title(page)).toHaveText("Act");
    await page.keyboard.type("a");
    await expect(title(page)).toHaveText("After");
  });
});

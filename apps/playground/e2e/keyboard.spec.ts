import { expect, test, type Page } from "@playwright/test";
import type { Config } from "driver.js";
import { activeIndex, isActive, log, openFixture, overlay, popover, settle, title } from "./harness";

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

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("Escape", () => {
  const cases: [string, Config, "closes" | "stays"][] = [
    ["allowClose is false", { allowClose: false }, "stays"],
    ["the close button is disabled", { disableButtons: ["close"] }, "stays"],
    ["the close button is only hidden", { showButtons: ["next", "previous"] }, "closes"],
    ["overlayClickBehavior is none", { overlayClickBehavior: "none" }, "closes"],
  ];

  test("closes the tour unless closing is switched off", async ({ page }) => {
    for (const [name, config, outcome] of cases) {
      await start(page, config);
      await page.keyboard.press("Escape");
      await settle(page);

      expect(await isActive(page), `Escape ${outcome} when ${name}`).toBe(outcome === "stays");
      await expect(popover(page), `Escape ${outcome} when ${name}`).toHaveCount(outcome === "stays" ? 1 : 0);
    }
  });

  test("closes a highlight", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({ animate: false });
      window.tour.highlight({ element: "#intro", popover: { title: "Intro" } });
    });
    await expect(title(page)).toHaveText("Intro");
    await settle(page);

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    expect(await isActive(page)).toBe(false);
  });
});

test.describe("arrow keys", () => {
  test("ArrowLeft on the first step leaves the tour where it is", async ({ page }) => {
    await start(page, { allowClose: false });
    await page.keyboard.press("ArrowLeft");
    await settle(page);

    expect(await isActive(page)).toBe(true);
    expect(await activeIndex(page)).toBe(0);
    await expect(title(page)).toHaveText("Step 1");
  });

  test("ArrowRight on the last step runs onDoneClick instead of onNextClick", async ({ page }) => {
    await page.evaluate(steps => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps,
        onDoneClick: () => window.log.push("done"),
        onNextClick: () => window.log.push("next"),
      });
      window.tour.drive(2);
    }, STEPS);
    await expect(title(page)).toHaveText("Step 3");
    await settle(page);

    await page.keyboard.press("ArrowRight");
    await expect.poll(() => log(page)).toEqual(["done"]);
    await settle(page);
    expect(await log(page)).toEqual(["done"]);
    expect(await isActive(page)).toBe(true);
  });

  test("do nothing, like Escape, when allowKeyboardControl is false", async ({ page }) => {
    await start(page, { allowKeyboardControl: false });

    await page.keyboard.press("ArrowRight");
    await settle(page);
    expect(await activeIndex(page)).toBe(0);

    await page.keyboard.press("Escape");
    await settle(page);
    expect(await isActive(page)).toBe(true);
    await expect(title(page)).toHaveText("Step 1");
  });

  test("are ignored while the highlight is moving", async ({ page }) => {
    const state = () => page.evaluate(() => `${window.tour.getActiveIndex()} ${window.log.join()}`);

    await page.evaluate(steps => {
      window.tour = window.driverjs.driver({
        duration: 1500,
        steps,
        onHighlighted: (_element, step) => {
          window.log.push(`${step.popover?.title}`);
        },
      });
      window.tour.drive();
    }, STEPS);
    await page.keyboard.press("ArrowRight");
    expect(await state()).toBe("0 ");

    await page.waitForFunction(() => window.log.length === 1);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowLeft");
    expect(await state()).toBe("1 Step 1");
  });

  const gated: [string, string, number, Config][] = [
    ["ArrowRight", "the next button is hidden", 0, { showButtons: ["previous", "close"] }],
    ["ArrowRight", "the next button is disabled for the tour", 0, { disableButtons: ["next"] }],
    ["ArrowLeft", "the previous button is hidden", 1, { showButtons: ["next", "close"] }],
    [
      "ArrowRight",
      "the next button is disabled on the step",
      0,
      {
        steps: [
          { element: "#one", popover: { title: "Step 1", disableButtons: ["next"] } },
          { element: "#two", popover: { title: "Step 2" } },
        ],
      },
    ],
  ];

  test("follow the buttons: a hidden or disabled button switches its key off", async ({ page }) => {
    for (const [key, name, index, config] of gated) {
      await start(page, config, index);
      await page.keyboard.press(key);
      await settle(page);

      expect(await activeIndex(page), `${key} when ${name}`).toBe(index);
      expect(await isActive(page), `${key} when ${name}`).toBe(true);
    }

    await start(page);
    await page.evaluate(() => window.tour.updatePopover({ showButtons: ["close"] }));
    await page.keyboard.press("ArrowRight");
    await settle(page);
    expect(await activeIndex(page), "ArrowRight after updatePopover hid Next").toBe(0);

    await page.evaluate(() => window.tour.updatePopover({ showButtons: ["next", "close"] }));
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Step 2");
  });
});

test.describe("keys that belong to a widget in the highlighted element", () => {
  for (const where of ["its own keydown handler", "a capture handler on the document"]) {
    test(`Escape stays with a menu that moves focus outside from ${where}`, async ({ page }) => {
      await page.evaluate(where => {
        document.querySelector("#slot")!.innerHTML = `
          <button id="trigger" type="button">Trigger</button>
          <div id="menu" role="menu"><button id="item" type="button">Item</button></div>
        `;
        const trigger = document.querySelector<HTMLElement>("#trigger")!;
        const target = where.startsWith("its own") ? document.querySelector("#item")! : document;
        target.addEventListener(
          "keydown",
          event => {
            if ((event as KeyboardEvent).key === "Escape") {
              trigger.focus();
            }
          },
          target === document
        );

        window.tour = window.driverjs.driver({
          animate: false,
          steps: [{ element: "#menu", popover: { title: "Menu" } }],
        });
        window.tour.drive();
      }, where);
      await expect(title(page)).toHaveText("Menu");
      await settle(page);

      await page.locator("#item").focus();
      await page.keyboard.press("Escape");
      await expect(page.locator("#trigger")).toBeFocused();
      await settle(page);
      expect(await isActive(page)).toBe(true);
      await expect(popover(page)).toHaveCount(1);

      await page.keyboard.press("Escape");
      await expect(popover(page)).toHaveCount(0);
    });
  }
});

test.describe("keyboard on a plain tour", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#field", popover: { title: "Field" } },
          { element: "#intro", popover: { title: "Intro" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("One");
    await expect(overlay(page)).toHaveCount(1);
    await settle(page);
  });

  test("arrows move and Escape closes", async ({ page }) => {
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Field");
    await settle(page);
    await page.locator(".driver-popover-next-btn").focus();
    await page.keyboard.press("ArrowLeft");
    await expect(title(page)).toHaveText("One");
    await settle(page);
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
  });

  test("arrow keys typed into a highlighted field stay with the field", async ({ page }) => {
    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Field");
    await page.locator("#field").click();
    await page.keyboard.type("abc");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await settle(page);

    await expect(title(page)).toHaveText("Field");
    await expect(page.locator("#field")).toHaveValue("abc");
  });
});

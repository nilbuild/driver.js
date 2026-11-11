import { expect, test, type Page } from "@playwright/test";
import type { Config } from "driver.js";
import { openFixture, overlay, popover, settle, title } from "./harness";

async function start(page: Page, config: Config) {
  await page.evaluate(config => {
    window.tour = window.driverjs.driver({ animate: false, ...(config as Config) });
    window.tour.drive();
  }, config as object);
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

const focusedId = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);

async function tabThrough(page: Page, key: "Tab" | "Shift+Tab", presses: number) {
  const seen: (string | undefined)[] = [];
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(key);
    seen.push(await focusedId(page));
  }

  return seen;
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("focus when a step starts", () => {
  test("moves into the popover when it was somewhere else", async ({ page }) => {
    await page.locator("#three").focus();
    await start(page, { steps: [{ element: "#intro", popover: { title: "Intro" } }] });

    await expect(popover(page).locator(":focus")).toHaveCount(1);
  });

  test("stays on the highlighted element, and the step is announced instead", async ({ page }) => {
    await page.locator("#two").focus();
    await start(page, { steps: [{ element: "#two", popover: { title: "Press it", description: "Go on" } }] });

    await expect(page.locator("#two")).toBeFocused();
    await expect(page.locator(".driver-live-region")).toHaveText("Press it. Go on");
  });

  test("stays on an allowed element", async ({ page }) => {
    await page.locator("#side-btn").focus();
    await start(page, { steps: [{ element: "#intro", allowedElements: "#side", popover: { title: "Intro" } }] });

    await expect(page.locator("#side-btn")).toBeFocused();
  });
});

test.describe("Tab", () => {
  test("reaches allowed elements", async ({ page }) => {
    await start(page, {
      steps: [{ element: "#intro", allowedElements: "#side", popover: { title: "Intro", showButtons: [] } }],
    });

    expect(await tabThrough(page, "Tab", 2)).toEqual(["side-btn", "side-btn"]);
  });

  test("reaches tabindex and contenteditable elements inside the highlighted element", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="panel">
          <div id="custom" tabindex="0">Custom</div>
          <div id="editable" contenteditable="true">Editable</div>
          <div id="skipped" tabindex="-1">Skipped</div>
        </div>
      `;
    });
    await start(page, { steps: [{ element: "#panel", popover: { title: "Panel", showButtons: [] } }] });

    expect(await tabThrough(page, "Tab", 3)).toEqual(["custom", "editable", "custom"]);
    expect(await tabThrough(page, "Shift+Tab", 1)).toEqual(["editable"]);
  });

  test("visits each element once when the highlighted element sits inside an allowed one", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="menu">
          <button id="item-a" type="button">A</button>
          <button id="item-b" type="button">B</button>
          <button id="item-c" type="button">C</button>
        </div>
      `;
    });
    await start(page, {
      steps: [{ element: "#item-b", allowedElements: "#menu", popover: { title: "B", showButtons: [] } }],
    });

    await page.locator("#item-b").focus();
    expect(await tabThrough(page, "Tab", 4)).toEqual(["item-a", "item-c", "item-b", "item-a"]);
  });

  test("is trapped during the tour and free again once it is destroyed", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<input id="first" type="text" /> <input id="second" type="text" />`;
    });
    await start(page, { steps: [{ element: "#first", popover: { title: "First", showButtons: [] } }] });

    await page.locator("#first").focus();
    expect(await tabThrough(page, "Tab", 2)).toEqual(["first", "first"]);
    expect(await tabThrough(page, "Shift+Tab", 2)).toEqual(["first", "first"]);
    await page.keyboard.type("ab");
    await expect(page.locator("#first")).toHaveValue("ab");

    await page.evaluate(() => window.tour.destroy());
    await page.locator("#first").focus();
    expect(await tabThrough(page, "Tab", 1)).toEqual(["second"]);
    expect(await tabThrough(page, "Shift+Tab", 1)).toEqual(["first"]);
  });
});

test("a press on the overlay does not take focus out of the popover", async ({ page }) => {
  await start(page, {
    overlayClickBehavior: "none",
    steps: [{ element: "#intro", popover: { title: "Intro" } }, { element: "#two" }],
  });
  await expect(popover(page).locator(":focus")).toHaveCount(1);
  const focused = await page.evaluate(() => document.activeElement?.className);

  await page.mouse.click(5, 5);
  await page.mouse.click(600, 500, { button: "right" });
  await settle(page);

  expect(await page.evaluate(() => document.activeElement?.className)).toBe(focused);
  await expect(title(page)).toHaveText("Intro");
});

test.describe("focus on a plain tour", () => {
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

  test("Tab stays inside the popover and the highlighted element", async ({ page }) => {
    const seen = new Set<string>();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press("Tab");
      seen.add(await page.evaluate(() => document.activeElement?.id || document.activeElement?.className || ""));
    }

    expect([...seen].sort()).toEqual(
      ["driver-popover-close-btn", "driver-popover-next-btn driver-popover-footer-btn", "one"].sort()
    );

    await page.keyboard.press("Shift+Tab");
    const focused = await page.evaluate(() => document.activeElement?.closest(".driver-popover, #one") !== null);
    expect(focused).toBe(true);
  });

  test("focus returns to where it was when the tour ends", async ({ page }) => {
    await page.evaluate(() => window.tour.destroy());
    await page.locator("#three").focus();
    await page.evaluate(() => window.tour.drive());
    await expect(title(page)).toHaveText("One");
    await page.keyboard.press("Escape");
    await expect(page.locator("#three")).toBeFocused();
  });
});

import { expect, test } from "@playwright/test";

type Page = import("@playwright/test").Page;

const title = (page: Page) => page.locator(".driver-popover-title");
const settle = (page: Page) =>
  page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

test("advanceOnClick still advances on a click", async ({ page }) => {
  await page.goto("/advance-on-click");
  await expect(title(page)).toHaveText("Click the Button");

  await page.locator("#card-1").click();
  await expect(title(page)).toHaveText("This One Too");
});

test("waitForElement still follows an element rendered on demand", async ({ page }) => {
  await page.goto("/wait-for-element");
  await expect(title(page)).toHaveText("Open Something");

  await page.locator("#card-1").click();
  await expect(title(page)).toHaveText("Worth the Wait", { timeout: 3000 });
});

test("arrow keys and Escape still drive a plain tour", async ({ page }) => {
  await page.goto("/non-animated-tour");
  const first = await title(page).textContent();

  await page.keyboard.press("ArrowRight");
  await expect(title(page)).not.toHaveText(first || "");
  await settle(page);

  await page.keyboard.press("ArrowLeft");
  await expect(title(page)).toHaveText(first || "");

  await page.keyboard.press("Escape");
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});

test("outside click still closes a plain tour", async ({ page }) => {
  await page.goto("/non-animated-tour");
  await expect(page.locator(".driver-popover")).toHaveCount(1);

  await page.mouse.click(5, 5);
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});

import { expect, test, type Page } from "@playwright/test";

const title = (page: Page) => page.locator(".driver-popover-title");
const description = (page: Page) => page.locator(".driver-popover-description");
const popover = (page: Page) => page.locator(".driver-popover");

async function expectNudgeWithoutFade(page: Page) {
  await page.waitForFunction(() => document.querySelector(".driver-popover")?.getAnimations().length === 0);
  await page.evaluate(() => {
    const state = window as unknown as { minOpacity: number };
    state.minOpacity = 1;
    const sample = () => {
      const wrapper = document.querySelector(".driver-popover");
      if (wrapper) {
        state.minOpacity = Math.min(state.minOpacity, parseFloat(getComputedStyle(wrapper).opacity));
      }
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });

  await page.locator("#demo-file").click();
  await expect(popover(page)).toHaveClass(/driver-popover-nudge/);
  await expect(popover(page)).not.toHaveClass(/driver-popover-nudge/, { timeout: 2000 });
  await page.waitForTimeout(600);

  const minOpacity = await page.evaluate(() => (window as unknown as { minOpacity: number }).minOpacity);
  expect(minOpacity).toBe(1);
}

test.describe("guided rename", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/action-driven-rename");
    await expect(title(page)).toHaveText("Open the menu");
  });

  test("completes when every action is performed", async ({ page }) => {
    await page.locator("#demo-file").click({ button: "right" });
    await expect(title(page)).toHaveText("Choose Rename");

    await page.locator(".demo-menu [data-action=rename]").click();
    await expect(title(page)).toHaveText("Name it");

    await page.locator("#demo-rename-input").fill("notes.pdf");
    await page.keyboard.press("Enter");
    await expect(title(page)).toHaveText("Renamed");
    await expect(page.locator(".demo-file-name")).toHaveText("notes.pdf");

    await page.locator(".driver-popover-next-btn").click();
    await expect(popover(page)).toHaveCount(0);
  });

  test("rejects a left click on the file with a hint", async ({ page }) => {
    await page.locator("#demo-file").click();

    await expect(description(page)).toContainText("Right-click the file");
    await expect(title(page)).toHaveText("Open the menu");
    await expect(page.locator(".demo-menu")).toHaveCount(0);
  });

  test("rejects a click outside without closing the tour", async ({ page }) => {
    await page.mouse.click(5, 5);

    await expect(description(page)).toContainText("Right-click the file");
    await expect(popover(page)).toHaveCount(1);
  });

  test("shakes the popover on a wrong action without fading it again", async ({ page }) => {
    await expectNudgeWithoutFade(page);
  });

  test("flashes the popover with reduced motion without fading it again", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await expectNudgeWithoutFade(page);
  });

  test("keeps focus in the menu when the next step starts", async ({ page }) => {
    await page.locator("#demo-file").click({ button: "right" });
    await expect(title(page)).toHaveText("Choose Rename");

    const focused = await page.evaluate(() => document.activeElement?.getAttribute("data-action"));
    expect(focused).toBe("rename");
  });

  test("sends the trainee back when Escape closes the menu", async ({ page }) => {
    await page.locator("#demo-file").click({ button: "right" });
    await expect(title(page)).toHaveText("Choose Rename");

    await page.keyboard.press("Escape");

    await expect(title(page)).toHaveText("Open the menu");
    await expect(description(page)).toContainText("The menu closed");
    await expect(popover(page)).toHaveCount(1);
  });

  test("can reopen the menu after it closed and still finish", async ({ page }) => {
    await page.locator("#demo-file").click({ button: "right" });
    await page.keyboard.press("Escape");
    await expect(title(page)).toHaveText("Open the menu");

    await page.locator("#demo-file").click({ button: "right" });
    await expect(title(page)).toHaveText("Choose Rename");
    await page.locator(".demo-menu [data-action=rename]").click();
    await expect(title(page)).toHaveText("Name it");
  });

  test("announces the corrective text to screen readers", async ({ page }) => {
    await page.locator("#demo-file").click();

    await expect(page.locator(".driver-live-region")).toContainText("Right-click the file");
  });
});

test.describe("wrong-action feedback", () => {
  test("advances on a double-click and lets single clicks through", async ({ page }) => {
    await page.goto("/action-driven-feedback");
    await expect(title(page)).toHaveText("Double-click");

    await page.locator("#card-1").click();
    await expect(title(page)).toHaveText("Double-click");

    await page.locator("#card-1").dblclick();
    await expect(title(page)).toHaveText("Got it");
  });

  test("blocks a right-click and counts attempts", async ({ page }) => {
    await page.goto("/action-driven-feedback");

    await page.locator("#card-1").click({ button: "right" });
    await expect(title(page)).toHaveText("Not that (1)");

    await page.mouse.click(5, 5);
    await expect(title(page)).toHaveText("Not that (2)");
  });
});

test.describe("waiting and retry", () => {
  test("keeps the step after a timeout and moves on after a retry", async ({ page }) => {
    await page.goto("/action-driven-wait");
    await expect(title(page)).toHaveText("Load");

    await page.locator("#card-2").click();
    await expect(popover(page)).toHaveClass(/driver-popover-waiting/);
    await expect(description(page)).toContainText("Still loading", { timeout: 4000 });
    await expect(popover(page)).not.toHaveClass(/driver-popover-waiting/);

    await page.locator("#card-2").click();
    await expect(title(page)).toHaveText("Loaded", { timeout: 4000 });
  });
});

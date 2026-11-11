import { expect, test, type Page } from "@playwright/test";
import type { Checklist, ChecklistConfig } from "driver.js/checklist";
import { box, log, nextButton, openFixture, popover, settle, title } from "./harness";

declare global {
  interface Window {
    onboarding: Checklist;
  }
}

type StagedConfig = Pick<ChecklistConfig, "position" | "offset" | "launcher" | "launcherText">;

const LONG_LABEL = "A <b>very</b> long launcher label that keeps going well past the edge of a small screen";

const root = (page: Page) => page.locator(".driver-checklist");
const panel = (page: Page) => page.locator(".driver-checklist-panel");
const launcher = (page: Page) => page.locator(".driver-checklist-launcher");
const closeButton = (page: Page) => page.locator(".driver-checklist-close-btn");
const item = (page: Page, id: string) => page.locator(`.driver-checklist-item-trigger[data-item-id="${id}"]`);
const doneItem = (page: Page, id: string) => page.locator(`.driver-checklist-item-done [data-item-id="${id}"]`);

const isOpen = (page: Page) => page.evaluate(() => window.onboarding.isOpen());

const pageSize = (page: Page) =>
  page.evaluate(() => ({
    width: document.documentElement.clientWidth,
    height: document.documentElement.clientHeight,
  }));

async function showChecklist(page: Page, config: StagedConfig = {}) {
  await page.evaluate(config => {
    window.onboarding?.hide();
    window.onboarding = window.driverjs.checklist({
      id: "e2e",
      title: "Get started",
      items: [
        {
          id: "tour",
          title: "Take the tour",
          tour: {
            animate: false,
            steps: [
              { element: "#intro", popover: { title: "Step 1" } },
              { element: "#two", popover: { title: "Step 2" } },
            ],
          },
        },
        { id: "docs", title: "Read the docs", href: "#docs" },
        { id: "guide", title: "Read the guide", href: "#guide" },
        { id: "invite", title: "Invite a teammate", action: () => window.log.push("action:invite") },
      ],
      ...config,
    });
    window.onboarding.show();
  }, config);
  await expect(root(page)).toHaveCount(1);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("checklist placement", () => {
  test("sits 20px off the bottom-right corner by default, with the panel above the launcher", async ({ page }) => {
    await showChecklist(page);
    const view = await pageSize(page);

    const closed = await box(root(page));
    expect(closed.x + closed.width).toBeCloseTo(view.width - 20, 0);
    expect(closed.y + closed.height).toBeCloseTo(view.height - 20, 0);
    await expect(panel(page)).toBeHidden();

    await launcher(page).click();
    await expect(panel(page)).toBeVisible();
    const button = await box(launcher(page));
    const list = await box(panel(page));
    expect(button.x + button.width).toBeCloseTo(view.width - 20, 0);
    expect(button.y + button.height).toBeCloseTo(view.height - 20, 0);
    expect(list.width).toBeCloseTo(320, 0);
    expect(list.x + list.width).toBeCloseTo(view.width - 20, 0);
    expect(list.y + list.height).toBeLessThanOrEqual(button.y);
  });

  test("supports the top corners and a custom offset, and leaves an unset axis to the stylesheet", async ({ page }) => {
    await showChecklist(page, { position: "top-left", offset: { x: 32, y: 90 } });
    await launcher(page).click();
    await expect(panel(page)).toBeVisible();

    const corner = await box(root(page));
    const button = await box(launcher(page));
    expect(corner.x).toBeCloseTo(32, 0);
    expect(corner.y).toBeCloseTo(90, 0);
    expect(button.x).toBeCloseTo(32, 0);
    expect(button.y).toBeCloseTo(90, 0);
    await expect.poll(async () => (await box(panel(page))).x).toBeCloseTo(32, 0);
    expect((await box(panel(page))).y).toBeGreaterThanOrEqual(button.y + button.height);

    await showChecklist(page, { position: "top-right", offset: { x: 0 } });
    const view = await pageSize(page);
    const topRight = await box(root(page));
    expect(topRight.x + topRight.width).toBeCloseTo(view.width, 0);
    expect(topRight.y).toBeCloseTo(20, 0);

    await showChecklist(page, { offset: { y: 0 } });
    const flush = await box(root(page));
    expect(flush.x + flush.width).toBeCloseTo(view.width - 20, 0);
    expect(flush.y + flush.height).toBeCloseTo(view.height, 0);
  });

  test("shows the full launcher label as a tooltip only while it is cut off", async ({ page }) => {
    await page.setViewportSize({ width: 360, height: 640 });
    await showChecklist(page, { launcherText: LONG_LABEL });

    const view = await pageSize(page);
    const button = await box(launcher(page));
    expect(button.x).toBeGreaterThanOrEqual(0);
    expect(button.x + button.width).toBeLessThanOrEqual(view.width);
    await expect(launcher(page)).toHaveAttribute(
      "title",
      "A very long launcher label that keeps going well past the edge of a small screen"
    );

    await page.setViewportSize({ width: 1280, height: 720 });
    await expect(launcher(page)).not.toHaveAttribute("title");

    await page.setViewportSize({ width: 360, height: 640 });
    await expect(launcher(page)).toHaveAttribute("title", /^A very long launcher label/);

    await showChecklist(page, { launcherText: "Setup" });
    await expect(launcher(page)).not.toHaveAttribute("title");
  });
});

test.describe("checklist keyboard and focus", () => {
  test("Escape closes it only from inside, and focus goes back to the launcher", async ({ page }) => {
    await showChecklist(page);
    await page.evaluate(() => window.onboarding.open());
    await expect(panel(page)).toBeVisible();

    await page.locator("#one").focus();
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await isOpen(page)).toBe(true);
    await expect(panel(page)).toBeVisible();

    await item(page, "tour").focus();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    expect(await isOpen(page)).toBe(false);
    await expect(launcher(page)).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await page.locator("#one").focus();
    await closeButton(page).click();
    await expect(panel(page)).toBeHidden();
    expect(await isOpen(page)).toBe(false);
    await expect(launcher(page)).toBeFocused();
  });

  test("without a launcher, focus goes back to the page's own trigger", async ({ page }) => {
    await showChecklist(page, { launcher: false });
    await expect(launcher(page)).toHaveCount(0);
    await page.evaluate(() => {
      document.querySelector("#one")!.addEventListener("click", () => window.onboarding.open());
    });

    await page.locator("#one").focus();
    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await item(page, "tour").focus();
    await page.keyboard.press("Escape");
    await expect(panel(page)).toBeHidden();
    await expect(page.locator("#one")).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(panel(page)).toBeVisible();
    await closeButton(page).click();
    await expect(panel(page)).toBeHidden();
    await expect(page.locator("#one")).toBeFocused();
  });

  test("hands focus back to the item once its tour ends", async ({ page }) => {
    await showChecklist(page);
    await launcher(page).click();
    await item(page, "tour").focus();
    await page.keyboard.press("Enter");

    await expect(title(page)).toHaveText("Step 1");
    await expect(root(page)).toBeHidden();
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Step 2");
    await nextButton(page).click();

    await expect(popover(page)).toHaveCount(0);
    await expect(panel(page)).toBeVisible();
    await expect(doneItem(page, "tour")).toHaveCount(1);
    await expect(item(page, "tour")).toBeFocused();
  });

  test("keeps focus on the activated item after the list re-renders", async ({ page }) => {
    await showChecklist(page);
    await launcher(page).click();
    await item(page, "invite").focus();
    await page.keyboard.press("Enter");

    await expect(doneItem(page, "invite")).toHaveCount(1);
    expect(await log(page)).toEqual(["action:invite"]);
    await expect(item(page, "invite")).toBeFocused();
  });
});

test.describe("checklist links", () => {
  test("a link item is ticked and navigates on click, and when started from code", async ({ page }) => {
    await showChecklist(page);
    await launcher(page).click();

    await item(page, "docs").click();
    await expect(page).toHaveURL(/\/e2e\/?#docs$/);
    await expect(doneItem(page, "docs")).toHaveCount(1);
    await expect(doneItem(page, "guide")).toHaveCount(0);

    await page.evaluate(() => window.onboarding.start("guide"));
    await expect(page).toHaveURL(/\/e2e\/?#guide$/);
    await expect(doneItem(page, "guide")).toHaveCount(1);
    await expect(panel(page)).toBeVisible();
  });
});

test.describe("checklist tours", () => {
  test("a checklist item runs its tour and gets completed", async ({ page }) => {
    await page.evaluate(() => {
      const list = window.driverjs.checklist({
        id: "e2e",
        title: "Get started",
        items: [
          {
            id: "tour",
            title: "Take the tour",
            tour: { animate: false, steps: [{ element: "#intro", popover: { title: "From the list" } }] },
          },
        ],
      });
      list.show();
      list.open();
      list.start("tour");
    });

    await expect(title(page)).toHaveText("From the list");
    await nextButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".driver-checklist")).toHaveCount(1);
    expect(await page.evaluate(() => document.querySelectorAll("[class*=driver-checklist]").length)).toBeGreaterThan(0);
  });
});

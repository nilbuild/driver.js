import { expect, test, type Page } from "@playwright/test";
import { activeIndex, box, nextButton, openFixture, overlay, popover, settle, title, topElementAt } from "./harness";

const LOCK_CLASS = /driver-active-element-parent-no-scroll/;

const scrollTop = (page: Page, selector: string) => page.evaluate(s => document.querySelector(s)!.scrollTop, selector);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("element size changes", () => {
  test("the cutout follows the element as it grows and stays put when it gets hidden", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<div id="grow" style="width:120px;height:40px">Grow</div>`;
      window.tour = window.driverjs.driver({ animate: false });
      window.tour.highlight({ element: "#grow", popover: { title: "Grow", side: "bottom", align: "start" } });
    });
    await expect(overlay(page)).toHaveCount(1);
    const target = await box(page.locator("#grow"));
    const middle = target.y + target.height / 2;
    await expect.poll(() => topElementAt(page, target.x + 60, middle)).toBe("grow");
    expect(await topElementAt(page, target.x + 250, middle)).toBe("overlay");

    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#grow")!.style.width = "320px";
    });
    await expect.poll(() => topElementAt(page, target.x + 250, middle)).toBe("grow");
    expect(await topElementAt(page, target.x + 315, middle)).toBe("grow");
    expect(await topElementAt(page, target.x + 360, middle)).toBe("overlay");

    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#grow")!.style.height = "90px";
    });
    await expect.poll(() => topElementAt(page, target.x + 250, target.y + 85)).toBe("grow");
    const pop = await box(popover(page));
    expect(pop.y).toBeGreaterThanOrEqual(target.y + 90);

    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#grow")!.style.display = "none";
    });
    await settle(page);
    await settle(page);
    expect(await topElementAt(page, target.x + 250, target.y + 85)).toBe("body");
    expect(await topElementAt(page, target.x + 360, middle)).toBe("overlay");
    expect(await box(popover(page))).toEqual(pop);
  });
});

test.describe("scroll lock", () => {
  test("a scrollable parent cannot be scrolled while its child is highlighted, also after a re-render", async ({
    page,
  }) => {
    await page.evaluate(() => {
      const makeList = (id: string) => {
        const list = document.createElement("div");
        list.id = id;
        list.style.cssText = "width:240px;height:100px;overflow:auto";
        list.innerHTML = `<button id="item" type="button">Item</button><div style="height:500px"></div>`;
        document.querySelector("#slot")!.replaceChildren(list);
      };
      makeList("list");
      Object.assign(window, { makeList });
      document.documentElement.style.overflow = "hidden";

      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => {
          window.log.push("missing");
        },
        steps: [{ element: "#item", popover: { title: "Item", side: "right" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Item");

    const wheelOverItem = async () => {
      const item = await box(page.locator("#item"));
      const x = item.x + item.width / 2;
      const y = item.y + item.height / 2;
      await page.mouse.move(x + 60, y + 60);
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 60);
    };

    await expect(page.locator("#list")).toHaveClass(LOCK_CLASS);
    await expect(page.locator("#list")).toHaveCSS("overflow-y", "hidden");
    await wheelOverItem();
    await settle(page);
    expect(await scrollTop(page, "#list")).toBe(0);

    await page.evaluate(() => (window as unknown as { makeList: (id: string) => void }).makeList("list-again"));
    await expect(page.locator("#list-again")).toHaveClass(/driver-active-element-parent( |$)/);
    await expect(page.locator("#list-again")).toHaveClass(LOCK_CLASS);
    await expect(page.locator("#list-again")).toHaveCSS("overflow-y", "hidden");
    await expect(page.locator("#item")).toHaveClass(/driver-active-element/);
    await settle(page);
    await wheelOverItem();
    await settle(page);
    expect(await scrollTop(page, "#list-again")).toBe(0);

    await page.evaluate(() => window.tour.destroy());
    await expect(page.locator("#list-again")).not.toHaveClass(LOCK_CLASS);
    await expect(page.locator("#list-again")).toHaveCSS("overflow-y", "auto");
    await expect
      .poll(async () => {
        await wheelOverItem();

        return scrollTop(page, "#list-again");
      })
      .toBeGreaterThan(0);
  });
});

test.describe("focus", () => {
  test("moves into the popover when the highlighted element is not interactive", async ({ page }) => {
    await page.locator("#field").focus();
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#field", disableActiveInteraction: true, popover: { title: "Look" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Look");

    await expect(page.locator("#field")).not.toBeFocused();
    await expect(popover(page).locator(":focus")).toHaveCount(1);
    await page.keyboard.type("abc");
    await expect(page.locator("#field")).toHaveValue("");
  });
});

test.describe("accessibility", () => {
  test("the popover is a named, described dialog and the highlighted element points at it", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#two")!.setAttribute("aria-haspopup", "menu");
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", popover: { title: "Welcome", description: "Read this first." } },
          { element: "#two", popover: { title: "Act", description: "Why.", instruction: "Click <b>Two</b>." } },
        ],
      });
      window.tour.drive();
    });

    const dialog = page.getByRole("dialog", { name: "Welcome" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAccessibleDescription("Read this first.");
    const id = await popover(page).getAttribute("id");
    expect(id).toBeTruthy();
    await expect(page.locator("#one")).toHaveAttribute("aria-haspopup", "dialog");
    await expect(page.locator("#one")).toHaveAttribute("aria-expanded", "true");
    await expect(page.locator("#one")).toHaveAttribute("aria-controls", id!);
    await expect(page.locator(".driver-live-region")).toHaveAttribute("aria-live", "polite");

    await nextButton(page).click();
    const actionDialog = page.getByRole("dialog", { name: "Act" });
    await expect(actionDialog).toBeVisible();
    await expect(actionDialog).toHaveAccessibleDescription("Why. Click Two.");
    await expect(page.getByRole("dialog")).toHaveCount(1);
    for (const name of ["aria-haspopup", "aria-expanded", "aria-controls"]) {
      await expect(page.locator("#one")).not.toHaveAttribute(name);
    }
    await expect(page.locator("#two")).toHaveAttribute("aria-haspopup", "menu");
    await expect(page.locator("#two")).not.toHaveAttribute("aria-controls");

    await page.evaluate(() => window.tour.destroy());
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.locator("#two")).toHaveAttribute("aria-haspopup", "menu");
    await expect(page.locator("#two")).not.toHaveAttribute("aria-expanded");
  });
});

test.describe("an element that goes away", () => {
  test("leaves the popover where it was when it is hidden or removed", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#two", popover: { title: "Two" } },
          { element: "#three", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Two");
    await expect(overlay(page)).toHaveCount(1);
    await settle(page);
    const before = await box(popover(page));

    await page.evaluate(() => {
      document.querySelector<HTMLElement>("#two")!.style.display = "none";
    });
    await settle(page);
    await settle(page);
    expect(await box(popover(page))).toEqual(before);

    await page.evaluate(() => document.querySelector("#two")!.remove());
    await settle(page);
    await settle(page);
    expect(await box(popover(page))).toEqual(before);
    expect(await activeIndex(page)).toBe(0);
  });
});

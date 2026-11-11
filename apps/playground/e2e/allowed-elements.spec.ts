import { expect, test, type Page } from "@playwright/test";
import { activeIndex, box, log, openFixture, overlay, record, settle, title, topElementAt } from "./harness";

async function centerOf(page: Page, selector: string) {
  const rect = await box(page.locator(selector));

  return [rect.x + rect.width / 2, rect.y + rect.height / 2] as const;
}

const classesAfterRewrite = (page: Page, selector: string, className: string) =>
  page.evaluate(
    async ({ selector, className }) => {
      const element = document.querySelector(selector)!;
      element.className = className;
      await Promise.resolve();

      return element.className.split(" ").sort().join(" ");
    },
    { selector, className }
  );

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test("clicks inside an allowed element reach the app and are reported with region allowed", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      overlayClickBehavior: "none",
      onInteraction: (_element, _step, opts) => {
        window.log.push(`${opts.event.type} ${opts.region}`);
      },
      steps: [{ element: "#one", allowedElements: "#side", popover: { title: "One" } }],
    });
    window.tour.drive();
  });
  await expect(overlay(page)).toHaveCount(1);
  await record(page, "#side-btn", ["click"]);

  await page.locator("#side-btn").click();
  expect(await log(page)).toEqual(["click allowed", "click@#side-btn"]);
});

test.describe("class guard", () => {
  test("puts the highlighted element's classes back at once, for as long as the step is on it", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [
          { element: "#one", disableActiveInteraction: true, popover: { title: "One" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(page.locator("#one")).toHaveClass("driver-no-interaction driver-active-element");
    await record(page, "#one", ["click"]);
    await record(page, "#two", ["click"]);

    expect(await classesAfterRewrite(page, "#one", "selected")).toBe(
      "driver-active-element driver-no-interaction selected"
    );
    await page.locator("#one").click({ force: true });
    await settle(page);
    expect(await log(page)).toEqual([]);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Two");
    await settle(page);
    expect(await classesAfterRewrite(page, "#one", "picked")).toBe("picked");
    expect(await classesAfterRewrite(page, "#two", "app")).toBe("app driver-active-element");
    await settle(page);
    await expect(page.locator("#one")).toHaveClass("picked");
    await expect(page.locator("#two")).toHaveClass("app driver-active-element");

    expect(await topElementAt(page, ...(await centerOf(page, "#two")))).toBe("two");
    expect(await topElementAt(page, ...(await centerOf(page, "#one")))).toBe("overlay");
    await page.locator("#two").click();
    expect(await log(page)).toEqual(["click@#two"]);

    await page.evaluate(() => window.tour.destroy());
    expect(await classesAfterRewrite(page, "#two", "after")).toBe("after");
    await settle(page);
    await expect(page.locator("#two")).toHaveClass("after");
  });

  for (const form of ["a selector", "the element itself"]) {
    test(`puts an allowed element's class back before the next frame (allowed by ${form})`, async ({ page }) => {
      await page.evaluate(form => {
        const side = document.querySelector("#side")!;
        side.className = "menu";
        window.tour = window.driverjs.driver({
          animate: false,
          overlayClickBehavior: "none",
          steps: [
            { element: "#one", allowedElements: form === "a selector" ? ".menu" : [side], popover: { title: "One" } },
          ],
        });
        window.tour.drive();
      }, form);
      await expect(page.locator("#side")).toHaveClass("menu driver-allowed-element");
      await settle(page);

      const seen = await page.evaluate(async () => {
        const side = document.querySelector("#side")!;
        side.className = "menu open";
        await Promise.resolve();
        const afterMicrotask = side.className;
        const onNextFrame = await new Promise<string>(resolve => requestAnimationFrame(() => resolve(side.className)));

        return [afterMicrotask, onNextFrame];
      });
      expect(seen).toEqual(["menu open driver-allowed-element", "menu open driver-allowed-element"]);

      await record(page, "#side-btn", ["click"]);
      expect(await topElementAt(page, ...(await centerOf(page, "#side-btn")))).toBe("side-btn");
      await page.locator("#side-btn").click();
      expect(await log(page)).toEqual(["click@#side-btn"]);

      await page.evaluate(() => window.tour.destroy());
      await expect(page.locator("#side")).toHaveClass("menu open");
    });
  }
});

test("a re-rendered element is picked up again by the step's selector", async ({ page }) => {
  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `<button id="temp" type="button">Temp</button>`;
    window.tour = window.driverjs.driver({
      animate: false,
      onElementMissing: () => {
        window.log.push("missing");
      },
      steps: [
        { element: "#temp", popover: { title: "Target" } },
        { element: "#intro", popover: { title: "Intro" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("Target");

  await page.evaluate(() => {
    const replacement = document.createElement("button");
    replacement.id = "temp";
    replacement.textContent = "Temp again";
    document.querySelector("#temp")!.remove();
    document.querySelector("#slot")!.appendChild(replacement);
  });
  await expect(page.locator("#temp")).toHaveClass("driver-active-element");
  await settle(page);

  expect(await activeIndex(page)).toBe(0);
  expect(await page.evaluate(() => window.tour.getActiveElement() === document.querySelector("#temp"))).toBe(true);
  expect(await topElementAt(page, ...(await centerOf(page, "#temp")))).toBe("temp");
  expect(await log(page)).toEqual([]);
});

test.describe("allowedElements", () => {
  test("stay clickable while everything else is inert", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", allowedElements: "#side", popover: { title: "One" } }],
      });
      window.tour.drive();
    });
    await record(page, "#side-btn", ["click"]);
    await record(page, "#outside", ["click"]);

    await page.locator("#side-btn").click();
    await page.locator("#outside").click({ force: true });
    await settle(page);

    expect(await log(page)).toEqual(["click@#side-btn"]);
    const side = await box(page.locator("#side-btn"));
    await expect.poll(() => topElementAt(page, side.x + 3, side.y + 3)).toBe("side-btn");
    await expect(page.locator("#side")).toHaveClass(/driver-allowed-element/);

    await page.evaluate(() => window.tour.destroy());
    await expect(page.locator("#side")).not.toHaveClass(/driver-allowed-element/);
  });
});

test.describe("class guard with allowed elements", () => {
  test("puts driver classes back when the app rewrites className", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element: "#one", allowedElements: "#side", advanceOn: "click", popover: { title: "One" } }, {}],
      });
      window.tour.drive();
    });
    await expect(page.locator("#one")).toHaveClass(/driver-active-element/);
    await page.evaluate(() => {
      document.querySelector("#one")!.className = "app-class";
      document.querySelector("#side")!.className = "app-side";
    });

    await expect(page.locator("#one")).toHaveClass("app-class driver-active-element");
    await expect(page.locator("#side")).toHaveClass("app-side driver-allowed-element");
    await record(page, "#side-btn", ["click"]);
    await page.locator("#side-btn").click();
    await page.locator("#one").click();
    expect(await log(page)).toEqual(["click@#side-btn"]);
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("a highlighted element inside an allowed element", () => {
  const MENU = `
    <div id="menu" style="position:absolute;left:300px;top:200px;width:160px;padding:0;background:#fff;border:1px solid #999">
      <button type="button" data-item="profile" style="display:block;width:100%;margin:0;appearance:none;border:0;background:#fff;padding:6px 10px;text-align:left">Profile</button>
      <button type="button" data-item="settings" style="display:block;width:100%;margin:0;appearance:none;border:0;background:#fff;padding:6px 10px;text-align:left">Settings</button>
      <button type="button" data-item="logout" style="display:block;width:100%;margin:0;appearance:none;border:0;background:#fff;padding:6px 10px;text-align:left">Log out</button>
    </div>`;

  async function startInMenu(page: Page, inDialog = false) {
    await page.evaluate(
      ({ html, inDialog }) => {
        const host = inDialog ? document.createElement("dialog") : document.body;
        if (inDialog) {
          (host as HTMLDialogElement).style.cssText = "width:600px;height:400px;padding:0";
          document.body.appendChild(host);
          (host as HTMLDialogElement).showModal();
        }
        host.insertAdjacentHTML("beforeend", html);

        window.tour = window.driverjs.driver({
          animate: false,
          allowedElements: "#menu",
          steps: [
            { element: "#menu [data-item=settings]", popover: { title: "Settings", side: "right" } },
            { element: "#one", popover: { title: "After" } },
          ],
        });
        window.tour.drive();
      },
      { html: MENU, inDialog }
    );
    await expect(title(page)).toHaveText("Settings");
    await settle(page);
  }

  const item = (page: Page) => page.locator("[data-item=settings]");

  for (const inDialog of [false, true]) {
    test(`is marked and leaves no hole around the menu${inDialog ? " (in a dialog)" : ""}`, async ({ page }) => {
      await startInMenu(page, inDialog);

      await expect(item(page)).toHaveClass(/driver-active-element-raised/);
      await expect(item(page)).toHaveCSS("outline-style", "solid");
      await expect(item(page)).toHaveCSS("outline-width", "2px");
      expect(await item(page).evaluate(element => getComputedStyle(element).boxShadow)).toContain("inset");
      await expect(page.locator("[data-item=profile]")).not.toHaveClass(/driver-active-element-raised/);

      const menu = await box(page.locator("#menu"));
      const settings = await box(item(page));
      for (const [x, y] of [
        [menu.x - 4, settings.y + settings.height / 2],
        [menu.x + menu.width + 4, settings.y + settings.height / 2],
        [menu.x + menu.width + 4, menu.y + 2],
      ]) {
        expect(await topElementAt(page, x, y), `${x},${y}`).toBe("overlay");
      }

      await record(page, "[data-item=logout]", ["click"]);
      await page.locator("[data-item=logout]").click();
      expect(await log(page)).toEqual(["click@[data-item=logout]"]);

      await page.evaluate(() => window.tour.moveNext());
      await expect(title(page)).toHaveText("After");
      await expect(item(page)).not.toHaveClass(/driver-active-element/);

      await page.evaluate(() => window.tour.movePrevious());
      await expect(item(page)).toHaveClass(/driver-active-element-raised/);
      await page.evaluate(() => window.tour.destroy());
      await expect(item(page)).toHaveAttribute("class", "");
      await expect(page.locator("#menu")).toHaveAttribute("class", "");
    });
  }

  test("keeps its mark when the app rewrites className, and loses it when the menu is no longer allowed", async ({
    page,
  }) => {
    await startInMenu(page);

    expect(await classesAfterRewrite(page, "[data-item=settings]", "app-item")).toBe(
      "app-item driver-active-element driver-active-element-raised"
    );

    await page.evaluate(() => {
      const menu = document.querySelector("#menu")!;
      menu.id = "menu-renamed";
    });
    await expect(item(page)).not.toHaveClass(/driver-active-element-raised/);
    await expect(item(page)).toHaveClass(/driver-active-element/);
  });

  test("an element that is not inside an allowed element gets no mark and keeps its padding", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        allowedElements: "#side",
        steps: [{ element: "#one", popover: { title: "One" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("One");
    await settle(page);

    await expect(page.locator("#one")).not.toHaveClass(/driver-active-element-raised/);
    const one = await box(page.locator("#one"));
    expect(await topElementAt(page, one.x - 5, one.y + one.height / 2)).not.toBe("overlay");
  });
});

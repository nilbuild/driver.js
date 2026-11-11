import { expect, test, type Page } from "@playwright/test";
import {
  activeIndex,
  box,
  description,
  isActive,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  settle,
  title,
  topElementAt,
} from "./harness";

const WAITING = /driver-popover-waiting/;

const addToSlot = (page: Page, html: string) =>
  page.evaluate(html => {
    document.querySelector("#slot")!.insertAdjacentHTML("beforeend", html);
  }, html);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("while the tour waits for an element", () => {
  test("arrow keys are ignored until it shows up", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#two", popover: { title: "Two" } },
          { element: "#late", waitForElement: 5000, popover: { title: "Late" } },
          { element: "#three", popover: { title: "Three" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Two");
    await settle(page);
    await page.evaluate(() => window.tour.moveNext());
    await expect(popover(page)).toHaveClass(WAITING);

    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowRight");
    await settle(page);
    expect(await activeIndex(page)).toBe(1);
    await expect(title(page)).toHaveText("Two");
    await expect(popover(page)).toHaveClass(WAITING);

    await addToSlot(page, `<button id="late" type="button">Late</button>`);
    await expect(title(page)).toHaveText("Late");
    await settle(page);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Three");
  });

  test("after the first step's wait runs out, Escape honours a close button the hook disabled and the right arrow moves on", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: (_element, _step, opts) => {
          opts.driver.updatePopover({ description: "Unavailable, press Next to skip.", disableButtons: ["close"] });
          return false;
        },
        steps: [
          { element: "#missing", waitForElement: 150, popover: { title: "One" } },
          { element: "#intro", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(popover(page)).toHaveClass(WAITING);
    await expect(description(page)).toHaveText("Unavailable, press Next to skip.");
    await expect(popover(page)).not.toHaveClass(WAITING);

    await page.keyboard.press("Escape");
    await settle(page);
    expect(await isActive(page)).toBe(true);
    await expect(title(page)).toHaveText("One");

    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Two");
    await expect(page.locator("#intro")).toHaveClass(/driver-active-element/);
  });
});

test.describe("focus after a tour that started by waiting", () => {
  test("returns to the element that had it once the late element was shown and the tour closed", async ({ page }) => {
    await page.locator("#three").focus();
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#late", waitForElement: 5000, popover: { title: "First" } }],
      });
      window.tour.drive();
    });
    await expect(popover(page)).toHaveClass(WAITING);
    await addToSlot(page, `<div id="late">Late</div>`);
    await expect(page.locator("#late")).toHaveClass(/driver-active-element/);
    await expect(popover(page)).not.toHaveClass(WAITING);
    await settle(page);
    await expect(page.locator("#three")).not.toBeFocused();

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator("#three")).toBeFocused();
  });

  test("returns there too after two first-step waits in a row ran out", async ({ page }) => {
    await page.locator("#three").focus();
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => false,
        steps: [
          { element: "#missing-1", waitForElement: 150, popover: { title: "One" } },
          { element: "#missing-2", waitForElement: 150, popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(popover(page)).toHaveClass(WAITING);
    await expect(popover(page)).not.toHaveClass(WAITING);
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Two");

    await page.evaluate(() => window.tour.destroy());
    await expect(page.locator("#three")).toBeFocused();
  });
});

test.describe("an action that removes its own element", () => {
  const start = async (page: Page, options: { stopPropagation: boolean; next: string }) => {
    await page.evaluate(options => {
      const slot = document.querySelector("#slot")!;
      slot.innerHTML = `<button id="item" type="button">Item</button>`;
      const item = slot.querySelector("#item")!;
      item.addEventListener("click", event => {
        if (options.stopPropagation) {
          event.stopPropagation();
        }
        item.remove();
      });

      window.log.splice(0);
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: (_element, step, opts) => {
          window.log.push(`${opts.cause}:${step.popover?.title}`);
        },
        steps: [
          { element: "#item", advanceOn: "click", popover: { title: "Item" } },
          { element: options.next, waitForElement: 5000, popover: { title: "Next" } },
        ],
      });
      window.tour.drive();
    }, options);
    await expect(overlay(page)).toHaveCount(1);
    await settle(page);
  };

  test("is not reported as a removed element", async ({ page }) => {
    await start(page, { stopPropagation: false, next: "#later" });
    await page.locator("#item").click();
    await expect(page.locator("#item")).toHaveCount(0);
    await expect(popover(page)).toHaveClass(WAITING);
    await settle(page);
    expect(await log(page)).toEqual([]);

    await addToSlot(page, `<button id="later" type="button">Later</button>`);
    await expect(title(page)).toHaveText("Next");
    expect(await log(page)).toEqual([]);
    await page.evaluate(() => window.tour.destroy());

    await start(page, { stopPropagation: true, next: "#intro" });
    await page.locator("#item").click();
    await expect(title(page)).toHaveText("Next");
    await settle(page);
    expect(await log(page)).toEqual([]);
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("an element that comes back", () => {
  test("gets the spotlight and the popover where the same node was put back", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<button id="temp" type="button">Temp</button>`;
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => {
          window.log.push("missing");
        },
        steps: [{ element: "#temp", waitForElement: 5000, popover: { title: "Temp", side: "bottom" } }],
      });
      window.tour.drive();
    });
    await expect(page.locator("#temp")).toHaveClass(/driver-active-element/);
    await settle(page);
    const before = await box(page.locator("#temp"));
    await expect.poll(() => topElementAt(page, before.x + 4, before.y + 4)).toBe("temp");

    await page.evaluate(() => {
      const node = document.querySelector("#temp")!;
      Object.assign(window, { node });
      node.remove();
    });
    await expect(popover(page)).toHaveClass(WAITING);

    await page.evaluate(() => {
      const home = document.createElement("p");
      home.style.cssText = "margin:90px 0 0 160px";
      home.appendChild((window as unknown as { node: Element }).node);
      document.querySelector("#slot")!.appendChild(home);
    });
    await expect(popover(page)).not.toHaveClass(WAITING);
    await expect(page.locator("#temp")).toHaveClass(/driver-active-element/);

    const after = await box(page.locator("#temp"));
    expect(after.y - before.y).toBeGreaterThan(60);
    await expect.poll(() => topElementAt(page, after.x + 4, after.y + 4)).toBe("temp");
    expect(await topElementAt(page, before.x + 4, before.y + 4)).toBe("overlay");
    await expect
      .poll(async () => {
        const pop = await box(popover(page));
        return pop.y - (after.y + after.height);
      })
      .toBeGreaterThanOrEqual(0);
    const pop = await box(popover(page));
    expect(pop.y - (after.y + after.height)).toBeLessThan(40);
    expect(await log(page)).toEqual([]);
  });

  test("in a new dialog takes the popover and the overlay along", async ({ page }) => {
    const openDialog = (replace: boolean) =>
      page.evaluate(replace => {
        if (replace) {
          document.querySelector(".app-dialog")!.remove();
        }

        const dialog = document.createElement("dialog");
        dialog.className = "app-dialog";
        dialog.style.cssText = "width:320px;padding:24px";
        dialog.innerHTML = `<p>${replace ? "Second" : "First"}</p><button id="in-dialog" type="button">Go</button>`;
        document.body.appendChild(dialog);
        dialog.showModal();
      }, replace);

    await openDialog(false);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => {
          window.log.push("missing");
        },
        steps: [{ element: "#in-dialog", popover: { title: "In dialog", side: "bottom" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("In dialog");
    await expect(overlay(page)).toHaveCount(1);
    await settle(page);

    await openDialog(true);
    await expect(page.locator(".app-dialog p")).toHaveText("Second");
    await expect(page.locator("#in-dialog")).toHaveClass(/driver-active-element/);
    await settle(page);

    const target = await box(page.locator("#in-dialog"));
    await expect.poll(() => topElementAt(page, target.x + 4, target.y + 4)).toBe("in-dialog");
    const pop = await box(popover(page));
    expect(pop.y).toBeGreaterThanOrEqual(target.y + target.height);
    expect(pop.y - (target.y + target.height)).toBeLessThan(40);
    const hit = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".driver-popover"), {
      x: pop.x + pop.width / 2,
      y: pop.y + pop.height / 2,
    });
    expect(hit).toBe(true);
    const text = await box(page.locator(".app-dialog p"));
    expect(await topElementAt(page, text.x + 4, text.y + 4)).toBe("overlay");
    await expect(overlay(page)).toHaveCount(1);
    await expect(popover(page)).toHaveCount(1);
    expect(await log(page)).toEqual([]);

    await nextButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
  });
});

test.describe("missing and late elements", () => {
  test("waitForElement keeps the step, waits, then moves to the late element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Open" } },
          { element: "#late", waitForElement: 3000, popover: { title: "Late" } },
        ],
      });
      window.tour.drive();
      document.querySelector("#one")!.addEventListener("click", () => {
        setTimeout(() => {
          document.querySelector("#slot")!.innerHTML = `<button id="late" type="button">Late</button>`;
        }, 300);
      });
    });

    await page.locator("#one").click();
    await expect(popover(page)).toHaveClass(/driver-popover-waiting/);
    await expect(title(page)).toHaveText("Open");
    await expect(title(page)).toHaveText("Late");
    await expect(popover(page)).not.toHaveClass(/driver-popover-waiting/);
    await expect(page.locator("#late")).toHaveClass(/driver-active-element/);
  });

  test("waitForElement shows a waiting popover on the first step", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#late", waitForElement: 3000, popover: { title: "Late" } }],
      });
      window.tour.drive();
      setTimeout(() => {
        document.querySelector("#slot")!.innerHTML = `<button id="late" type="button">Late</button>`;
      }, 300);
    });

    await expect(popover(page)).toHaveClass(/driver-popover-waiting/);
    await expect(page.locator("#late")).toHaveClass(/driver-active-element/);
    await expect(popover(page)).not.toHaveClass(/driver-popover-waiting/);
  });

  test("onElementMissing hears about a removed element", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<button id="temp" type="button">Temp</button>`;
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: (_element, step, opts) => {
          window.log.push(`${opts.cause}:${step.popover?.title}`);
        },
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#temp", popover: { title: "Temp" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Temp");
    await page.evaluate(() => document.querySelector("#temp")!.remove());

    await expect.poll(() => log(page)).toEqual(["removed:Temp"]);
    expect(await activeIndex(page)).toBe(1);
  });

  test("follows an element the framework re-rendered", async ({ page }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `<button id="temp" type="button">Temp</button>`;
      window.tour = window.driverjs.driver({
        animate: false,
        onElementMissing: () => {
          window.log.push("missing");
        },
        steps: [{ element: "#temp", popover: { title: "Temp" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Temp");

    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML =
        `<p style="margin-top:80px"><button id="temp" type="button">Temp again</button></p>`;
    });
    await expect(page.locator("#temp")).toHaveClass(/driver-active-element/);
    await settle(page);

    const target = await box(page.locator("#temp"));
    await expect.poll(() => topElementAt(page, target.x + 4, target.y + 4)).toBe("temp");
    const pop = await box(popover(page));
    expect(pop.y).toBeGreaterThanOrEqual(target.y + target.height);
    expect(await log(page)).toEqual([]);
  });
});

test.describe("onElementMissing presets", () => {
  const start = async (page: Page, preset: "stay" | "previous" | "previousAction" | undefined, index = 2) => {
    await page.evaluate(
      ({ preset, index }) => {
        const slot = document.querySelector("#slot")!;
        const open = () => {
          slot.innerHTML = `<p id="menu"><span id="menu-info">Info</span> <button id="archive" type="button">Archive</button></p>`;
        };
        document.querySelector("#one")!.addEventListener("click", open);
        open();

        window.tour = window.driverjs.driver({
          animate: false,
          onElementMissing: preset,
          steps: [
            { element: "#one", advanceOn: "click", popover: { title: "Open", instruction: "Click One." } },
            { element: "#menu-info", waitForElement: 300, popover: { title: "Info" } },
            { element: "#archive", advanceOn: "click", popover: { title: "Archive", instruction: "Click Archive." } },
          ],
        });
        window.tour.drive(index);
      },
      { preset, index }
    );
    await expect(overlay(page)).toHaveCount(1);
  };

  const closeMenu = (page: Page) => page.evaluate(() => document.querySelector("#menu")!.remove());

  test('"previousAction" goes back to the step that opens the menu, and the tour can be finished', async ({ page }) => {
    await start(page, "previousAction");
    await closeMenu(page);

    await expect(title(page)).toHaveText("Open");
    const target = await box(page.locator("#one"));
    await expect.poll(() => topElementAt(page, target.x + 4, target.y + 4)).toBe("one");

    await page.locator("#one").click();
    await expect(title(page)).toHaveText("Info");
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Archive");
    await page.locator("#archive").click();
    await expect(popover(page)).toHaveCount(0);
  });
});

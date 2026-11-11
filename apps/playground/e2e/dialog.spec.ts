import { expect, test, type Page } from "@playwright/test";
import { box, log, nextButton, openFixture, overlay, popover, record, settle, title } from "./harness";

const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!element) {
        return "none";
      }

      if (element.closest(".driver-overlay")) {
        return "overlay";
      }

      return element.id || element.tagName.toLowerCase();
    },
    { x, y }
  );

const overlayHome = (page: Page) =>
  page.evaluate(() => {
    const parent = document.querySelector(".driver-overlay")?.parentElement;
    if (!parent) {
      return "none";
    }

    return parent === document.body ? "body" : parent.className || parent.tagName.toLowerCase();
  });

const layers = (page: Page) => page.locator(".driver-layer");

async function start(page: Page, options: { modal?: boolean; index?: number; allowed?: boolean; animate?: boolean }) {
  await page.evaluate(options => {
    const dialog = document.createElement("dialog");
    dialog.id = "dialog";
    dialog.style.cssText = "width:360px;padding:24px";
    dialog.innerHTML = `
      <p id="dialog-text">Create a project</p>
      <p><input id="dialog-field" type="text" /></p>
      <p><button id="dialog-cancel" type="button">Cancel</button> <button id="dialog-create" type="button">Create</button></p>
    `;
    document.body.appendChild(dialog);
    if (options.modal === false) {
      dialog.show();
    } else {
      dialog.showModal();
    }

    window.tour = window.driverjs.driver({
      animate: !!options.animate,
      duration: 150,
      overlayClickBehavior: "none",
      allowedElements: options.allowed ? "#dialog-cancel" : undefined,
      steps: [
        { element: "#intro", popover: { title: "Page" } },
        { element: "#dialog-field", popover: { title: "Field", side: "top" } },
        { element: "#dialog-create", advanceOn: "click", popover: { title: "Create", instruction: "Click Create." } },
        { element: "#one", popover: { title: "Page again" } },
      ],
    });
    window.tour.drive(options.index ?? 1);
  }, options);
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("steps inside a modal dialog", () => {
  test("dim the dialog too, with the element cut out and the popover on top", async ({ page }) => {
    await start(page, {});
    await expect(title(page)).toHaveText("Field");
    expect(await overlayHome(page)).toBe("driver-layer");

    const field = await box(page.locator("#dialog-field"));
    const cancel = await box(page.locator("#dialog-cancel"));
    const pop = await box(popover(page));
    await expect.poll(() => hitAt(page, field.x + field.width / 2, field.y + field.height / 2)).toBe("dialog-field");
    expect(await hitAt(page, cancel.x + 4, cancel.y + cancel.height / 2)).toBe("overlay");
    expect(await hitAt(page, 5, 5)).toBe("overlay");
    expect(await hitAt(page, pop.x + pop.width / 2, pop.y + 8)).not.toBe("overlay");

    const order = await page.evaluate(() => {
      const layer = document.querySelector(".driver-layer")!;
      return Array.from(layer.children).map(child => child.getAttribute("class")!.split(" ")[0]);
    });
    expect(order).toEqual(["driver-overlay", "driver-popover"]);
    await expect(overlay(page)).toHaveCount(1);
  });

  test("keep the highlighted field usable and everything else in the dialog inert", async ({ page }) => {
    await start(page, {});
    await page.locator("#dialog-field").click();
    await page.keyboard.type("Apollo");
    await expect(page.locator("#dialog-field")).toHaveValue("Apollo");

    await record(page, "#dialog-cancel", ["mousedown", "click"]);
    await page.evaluate(() => {
      for (const type of ["mousedown", "click"]) {
        document.body.addEventListener(type, () => window.log.push(`body ${type}`));
      }
    });

    const cancel = await box(page.locator("#dialog-cancel"));
    await page.mouse.click(cancel.x + cancel.width / 2, cancel.y + cancel.height / 2);
    await settle(page);
    expect(await log(page)).toEqual([]);
  });

  test("nudge on an overlay click over the dialog on an action step, and advance on the action", async ({ page }) => {
    await start(page, { index: 2 });
    await page.evaluate(() => window.tour.setConfig({ ...window.tour.getConfig(), overlayClickBehavior: "close" }));
    const cancel = await box(page.locator("#dialog-cancel"));

    await page.mouse.click(cancel.x + 4, cancel.y + cancel.height / 2);
    await expect(popover(page)).toHaveClass(/driver-popover-nudge/);
    await expect(title(page)).toHaveText("Create");

    await page.locator("#dialog-create").click();
    await expect(title(page)).toHaveText("Page again");
  });

  test("cut allowed elements out so they stay clickable", async ({ page }) => {
    await start(page, { allowed: true });
    await record(page, "#dialog-cancel", ["click"]);
    const cancel = await box(page.locator("#dialog-cancel"));

    await expect
      .poll(() => hitAt(page, cancel.x + cancel.width / 2, cancel.y + cancel.height / 2))
      .toBe("dialog-cancel");
    await page.locator("#dialog-cancel").click();
    expect(await log(page)).toEqual(["click@#dialog-cancel"]);

    const create = await box(page.locator("#dialog-create"));
    expect(await hitAt(page, create.x + create.width / 2, create.y + create.height / 2)).toBe("overlay");
  });

  test("stop redrawing the overlay once allowed elements settle", async ({ page }) => {
    await start(page, { allowed: true });

    const redraws = await page.evaluate(async () => {
      let count = 0;
      const path = document.querySelector(".driver-overlay path")!;
      const observer = new MutationObserver(records => (count += records.length));
      observer.observe(path, { attributes: true, attributeFilter: ["d"] });
      await new Promise(resolve => setTimeout(resolve, 500));
      observer.disconnect();

      return count;
    });

    expect(redraws).toBe(0);
  });

  test("move the overlay with the tour from the page into the dialog and back", async ({ page }) => {
    await start(page, { index: 0 });
    expect(await overlayHome(page)).toBe("body");
    await expect(layers(page)).toHaveCount(0);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Field");
    await expect.poll(() => overlayHome(page)).toBe("driver-layer");
    const field = await box(page.locator("#dialog-field"));
    await expect.poll(() => hitAt(page, field.x + 5, field.y + 5)).toBe("dialog-field");

    await page.evaluate(() => window.tour.moveTo(3));
    await expect(title(page)).toHaveText("Page again");
    await expect.poll(() => overlayHome(page)).toBe("body");
    await expect(layers(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(1);
  });

  test("animate the cutout between a page element and a dialog element", async ({ page }) => {
    await start(page, { index: 0, animate: true });
    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Field");

    const field = await box(page.locator("#dialog-field"));
    await expect.poll(() => overlayHome(page)).toBe("driver-layer");
    await expect.poll(() => hitAt(page, field.x + 5, field.y + 5)).toBe("dialog-field");
    const opacity = await overlay(page).evaluate(element => getComputedStyle(element).opacity);
    expect(opacity).toBe("1");
  });

  test("come back to the page when the dialog closes mid-step", async ({ page }) => {
    await start(page, {});
    await page.evaluate(() => (document.querySelector("#dialog") as HTMLDialogElement).close());

    await expect.poll(() => overlayHome(page)).toBe("body");
    await expect(layers(page)).toHaveCount(0);
    await expect(popover(page)).toBeVisible();
    expect(await hitAt(page, 600, 500)).toBe("overlay");

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
  });

  test("leave no layer behind on destroy", async ({ page }) => {
    await start(page, {});
    await expect(layers(page)).toHaveCount(1);

    await page.evaluate(() => window.tour.destroy());
    await expect(layers(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
    await page.locator("#dialog-cancel").click();
  });

  test("follow an element re-rendered inside the dialog", async ({ page }) => {
    await start(page, {});
    await page.evaluate(() => {
      const field = document.querySelector("#dialog-field")!;
      const copy = field.cloneNode(true) as HTMLElement;
      copy.style.marginTop = "30px";
      field.replaceWith(copy);
    });
    await expect(page.locator("#dialog-field")).toHaveClass(/driver-active-element/);
    await settle(page);

    const field = await box(page.locator("#dialog-field"));
    await expect.poll(() => hitAt(page, field.x + 5, field.y + 5)).toBe("dialog-field");
    expect(await overlayHome(page)).toBe("driver-layer");
    await expect(layers(page)).toHaveCount(1);
  });

  test("bring the popover into a dialog that opens while the step animates in", async ({ page }) => {
    await page.evaluate(() => {
      const dialog = document.createElement("dialog");
      dialog.innerHTML = `<input id="late-field" type="text" />`;
      document.body.appendChild(dialog);

      window.tour = window.driverjs.driver({
        animate: true,
        duration: 400,
        steps: [
          { element: "#intro", popover: { title: "Page" } },
          { element: "dialog #late-field", popover: { title: "Field", side: "top" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Page");
    await settle(page);

    await page.evaluate(() => {
      window.tour.moveNext();
      setTimeout(() => document.querySelector("dialog")!.showModal(), 150);
    });
    await expect(title(page)).toHaveText("Field");

    await expect
      .poll(() => page.evaluate(() => document.querySelector(".driver-popover")?.parentElement?.className))
      .toBe("driver-layer");
    const next = await box(nextButton(page));
    await expect.poll(() => hitAt(page, next.x + next.width / 2, next.y + next.height / 2)).not.toBe("overlay");
    const field = await box(page.locator("#late-field"));
    const pop = await box(popover(page));
    expect(pop.y + pop.height).toBeLessThanOrEqual(field.y);
  });
});

test("a non-modal dialog gets the overlay in its layer as well", async ({ page }) => {
  await start(page, { modal: false });
  const field = await box(page.locator("#dialog-field"));

  await expect.poll(() => hitAt(page, field.x + 5, field.y + 5)).toBe("dialog-field");
  expect(await hitAt(page, 5, 5)).toBe("overlay");
  await nextButton(page).click();
  await expect(title(page)).toHaveText("Create");
});

test("without popover support the overlay lives in the dialog itself", async ({ page }) => {
  await page.evaluate(() => {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>).showPopover;
  });
  await start(page, {});

  expect(await overlayHome(page)).toBe("dialog");
  const field = await box(page.locator("#dialog-field"));
  const cancel = await box(page.locator("#dialog-cancel"));
  await expect.poll(() => hitAt(page, field.x + 5, field.y + 5)).toBe("dialog-field");
  expect(await hitAt(page, cancel.x + 4, cancel.y + cancel.height / 2)).toBe("overlay");
  const pop = await box(popover(page));
  expect(await hitAt(page, pop.x + pop.width / 2, pop.y + 8)).not.toBe("overlay");

  await page.evaluate(() => window.tour.destroy());
  await expect(overlay(page)).toHaveCount(0);
});

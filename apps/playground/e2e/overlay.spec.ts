import { expect, test, type Page } from "@playwright/test";
import { box, log, near, openFixture, overlay, popover, record, settle, title, topElementAt } from "./harness";

type OverlayConfig = {
  overlayColor?: string;
  overlayOpacity?: number;
  stagePadding?: number;
  stageRadius?: number;
};

const path = (page: Page) => page.locator(".driver-overlay path");

const cutout = (page: Page) =>
  path(page).evaluate(element => {
    const d = element.getAttribute("d")!;
    const numbers = d.split("Z")[1].match(/M(\S+),(\S+) h(\S+) a(\S+),\S+ 0 0 1 \S+ v(\S+) /)!;
    const [x, y, width, radius, height] = numbers.slice(1).map(Number);

    return {
      x: x - radius,
      y,
      width: width + radius * 2,
      height: height + radius * 2,
      radius,
      subpaths: d.match(/M/g)!.length,
    };
  });

const paint = (page: Page) =>
  path(page).evaluate(element => {
    const style = getComputedStyle(element);

    return { fill: style.fill, opacity: style.opacity };
  });

async function highlight(page: Page, element: string, config: OverlayConfig = {}) {
  await page.evaluate(
    ({ element, config }) => {
      window.tour?.destroy();
      window.tour = window.driverjs.driver({ animate: false, ...config });
      window.tour.highlight({ element, popover: { title: "Target", side: "bottom" } });
    },
    { element, config }
  );
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

async function placeTarget(page: Page, css: string) {
  await page.evaluate(css => {
    const element = document.createElement("div");
    element.id = "target";
    element.style.cssText = `position:fixed;background:#cdd;${css}`;
    document.body.appendChild(element);
  }, css);
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("overlay paint", () => {
  test("is black at 70% by default and takes overlayColor and overlayOpacity", async ({ page }) => {
    await highlight(page, "#two");
    expect(await paint(page)).toEqual({ fill: "rgb(0, 0, 0)", opacity: "0.7" });
    expect(await overlay(page).evaluate((svg: SVGElement) => svg.parentElement === document.body)).toBe(true);
    expect(await overlay(page).evaluate((svg: SVGElement) => svg.style.animation)).toBe("");

    await highlight(page, "#two", { overlayColor: "rgb(255, 0, 0)", overlayOpacity: 0.4 });
    expect(await paint(page)).toEqual({ fill: "rgb(255, 0, 0)", opacity: "0.4" });

    await highlight(page, "#two", { overlayColor: "" });
    expect((await paint(page)).fill).toBe("rgb(0, 0, 0)");
  });
});

test.describe("cutout", () => {
  test("is the element's box grown by stagePadding, with stageRadius corners", async ({ page }) => {
    await placeTarget(page, "left:540px;top:320px;width:200px;height:40px");
    const element = await box(page.locator("#target"));
    const middle = element.y + element.height / 2;

    await highlight(page, "#target", { stagePadding: 20, stageRadius: 8 });
    const padded = await cutout(page);
    near(padded.x, element.x - 20);
    near(padded.y, element.y - 20);
    near(padded.width, element.width + 40);
    near(padded.height, element.height + 40);
    expect(padded.radius).toBe(8);
    await expect.poll(() => topElementAt(page, element.x + 5, middle)).toBe("target");
    expect(await topElementAt(page, element.x - 15, middle)).not.toBe("overlay");
    expect(await topElementAt(page, element.x - 25, middle)).toBe("overlay");
    expect(await topElementAt(page, element.x - 19, element.y - 19)).toBe("overlay");

    await highlight(page, "#target", { stagePadding: 20, stageRadius: 0 });
    expect(await topElementAt(page, element.x - 19, element.y - 19)).not.toBe("overlay");
  });

  test("is exactly the element's box with square corners when padding and radius are zero", async ({ page }) => {
    await placeTarget(page, "left:540px;top:320px;width:200px;height:40px");
    const element = await box(page.locator("#target"));
    await highlight(page, "#target", { stagePadding: 0, stageRadius: 0 });

    const flush = await cutout(page);
    near(flush.x, element.x);
    near(flush.y, element.y);
    near(flush.width, element.width);
    near(flush.height, element.height);
    expect(flush.radius).toBe(0);
    await expect.poll(() => topElementAt(page, element.x + 1, element.y + 1)).toBe("target");
    expect(await topElementAt(page, element.x - 2, element.y + element.height / 2)).toBe("overlay");
  });

  test("limits the radius to half of a tiny element, and treats a negative radius as none", async ({ page }) => {
    await placeTarget(page, "left:540px;top:320px;width:10px;height:10px");
    const element = await box(page.locator("#target"));

    await highlight(page, "#target", { stagePadding: 0, stageRadius: 20 });
    const round = await cutout(page);
    expect(round.radius).toBe(5);
    near(round.width, 10);
    near(round.height, 10);
    await expect.poll(() => topElementAt(page, element.x + 5, element.y + 5)).toBe("target");
    expect(await topElementAt(page, element.x + 1, element.y + 1)).toBe("overlay");

    await highlight(page, "#target", { stagePadding: 0, stageRadius: -5 });
    const square = await cutout(page);
    expect(square.radius).toBe(0);
    near(square.width, 10);
    await expect.poll(() => topElementAt(page, element.x + 1, element.y + 1)).toBe("target");
  });

  test("has no hole for a step without an element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        stagePadding: 20,
        stageRadius: 8,
        steps: [{ popover: { title: "No element" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("No element");
    await settle(page);

    const viewport = page.viewportSize()!;
    const hole = await cutout(page);
    expect(hole).toMatchObject({ width: 0, height: 0, radius: 0 });
    near(hole.x, viewport.width / 2);
    near(hole.y, viewport.height / 2);

    const pop = await box(popover(page));
    expect(await topElementAt(page, pop.x - 10, pop.y - 10)).toBe("overlay");
    expect(await topElementAt(page, 5, 5)).toBe("overlay");
  });

  test("a click in the padding around the element is not an overlay click, also when a theme lets the svg take clicks", async ({
    page,
  }) => {
    await placeTarget(page, "left:540px;top:320px;width:200px;height:40px");
    const element = await box(page.locator("#target"));
    await highlight(page, "#target", { stagePadding: 20 });

    await page.mouse.click(element.x - 12, element.y + element.height / 2);
    await settle(page);
    await expect(popover(page)).toHaveCount(1);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(true);

    await page.addStyleTag({ content: ".driver-active .driver-overlay { pointer-events: auto; }" });
    expect(await topElementAt(page, element.x - 12, element.y + element.height / 2)).toBe("overlay");
    await page.mouse.click(element.x - 12, element.y + element.height / 2);
    await settle(page);
    await expect(popover(page)).toHaveCount(1);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(true);

    await page.mouse.click(element.x - 40, element.y + element.height / 2);
    await expect(popover(page)).toHaveCount(0);
  });
});

async function driveIntoDialog(page: Page, gap: number) {
  await page.evaluate(gap => {
    const dialog = document.createElement("dialog");
    dialog.innerHTML = `
      <button id="dialog-save" type="button">Save</button>
      <button id="dialog-help" type="button" style="margin-left:${gap}px">Help</button>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();

    window.tour = window.driverjs.driver({
      animate: false,
      allowedElements: "#dialog-help, #side",
      steps: [
        { element: "#intro", popover: { title: "Page" } },
        { element: "#dialog-save", popover: { title: "Dialog" } },
      ],
    });
    window.tour.drive();
  }, gap);
  await expect(title(page)).toHaveText("Page");
  await settle(page);
}

test.describe("allowed elements", () => {
  test("get their own holes only when the overlay sits inside a dialog", async ({ page }) => {
    await driveIntoDialog(page, 60);
    expect((await cutout(page)).subpaths).toBe(2);

    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Dialog");
    await expect.poll(async () => (await cutout(page)).subpaths).toBe(3);

    const help = await box(page.locator("#dialog-help"));
    await expect.poll(() => topElementAt(page, help.x + 4, help.y + 4)).toBe("dialog-help");
    expect(await topElementAt(page, help.x - 8, help.y + 4)).toBe("overlay");
  });

  test("stay clear where their hole overlaps the padding around the highlighted element", async ({ page }) => {
    await driveIntoDialog(page, 0);
    await page.evaluate(() => window.tour.moveNext());
    await expect(title(page)).toHaveText("Dialog");

    const help = await box(page.locator("#dialog-help"));
    await expect.poll(() => topElementAt(page, help.x + 2, help.y + 4)).toBe("dialog-help");
    for (const [x, y] of [
      [help.x + 1, help.y + 1],
      [help.x + 9, help.y + help.height - 1],
      [help.x + 5, help.y + help.height / 2],
      [help.x + help.width - 2, help.y + 2],
    ]) {
      expect(await topElementAt(page, x, y)).toBe("dialog-help");
    }
    expect(await topElementAt(page, help.x + help.width + 6, help.y + 4)).toBe("overlay");
  });

  const isDimmed = (page: Page, x: number, y: number) =>
    page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest(".driver-overlay"), { x, y });

  async function driveOverlapping(page: Page, html: string, allowedElements: string) {
    await page.evaluate(
      ({ html, allowedElements }) => {
        const dialog = document.createElement("dialog");
        dialog.style.cssText = "width:420px;height:260px;padding:0";
        dialog.innerHTML = html;
        document.body.appendChild(dialog);
        dialog.showModal();

        window.tour = window.driverjs.driver({
          animate: false,
          allowedElements,
          steps: [{ element: "#target", popover: { title: "Dialog", side: "top" } }],
        });
        window.tour.drive();
      },
      { html, allowedElements }
    );
    await expect(title(page)).toHaveText("Dialog");
    await settle(page);
  }

  const at = "position:absolute;margin:0;padding:0;border:0;";

  test("leave no dimmed island when one sits inside the highlighted element's cutout", async ({ page }) => {
    await driveOverlapping(
      page,
      `<div id="target" style="${at}left:40px;top:40px;width:200px;height:80px">
         <button id="inner" type="button" style="${at}left:20px;top:20px;width:60px;height:30px">In</button>
       </div>`,
      "#inner"
    );

    const inner = await box(page.locator("#inner"));
    const target = await box(page.locator("#target"));
    for (const [x, y] of [
      [inner.x + 2, inner.y + 2],
      [inner.x + inner.width / 2, inner.y + inner.height / 2],
      [target.x - 5, target.y - 5],
      [target.x + target.width + 5, target.y + target.height + 5],
    ]) {
      expect(await isDimmed(page, x, y)).toBe(false);
    }
    expect(await isDimmed(page, target.x - 14, target.y + 20)).toBe(true);
  });

  test("union with the cutout when one overlaps it partly, corners included", async ({ page }) => {
    await driveOverlapping(
      page,
      `<div id="target" style="${at}left:60px;top:60px;width:120px;height:60px"></div>
       <button id="side-by" type="button" style="${at}left:150px;top:30px;width:120px;height:120px">Side</button>`,
      "#side-by"
    );

    const side = await box(page.locator("#side-by"));
    const target = await box(page.locator("#target"));
    const clear = [
      [side.x + 1, side.y + 1],
      [side.x + 1, target.y - 9],
      [side.x + 1, target.y + target.height + 9],
      [target.x + target.width + 9, target.y - 9],
      [target.x + target.width + 9.5, target.y + target.height + 9.5],
      [side.x + side.width - 1, side.y + side.height - 1],
      [target.x - 5, target.y + 30],
    ];
    for (const [x, y] of clear) {
      expect(await isDimmed(page, x, y), `${x},${y}`).toBe(false);
    }
    expect(await isDimmed(page, side.x + side.width + 3, side.y + 10)).toBe(true);
    expect(await isDimmed(page, target.x - 14, target.y + 30)).toBe(true);
  });

  test("union with each other when two of them overlap", async ({ page }) => {
    await driveOverlapping(
      page,
      `<div id="target" style="${at}left:20px;top:20px;width:60px;height:30px"></div>
       <button id="allowed-a" type="button" style="${at}left:160px;top:100px;width:120px;height:80px">A</button>
       <button id="allowed-b" type="button" style="${at}left:220px;top:140px;width:120px;height:80px">B</button>`,
      "#allowed-a, #allowed-b"
    );

    const a = await box(page.locator("#allowed-a"));
    const b = await box(page.locator("#allowed-b"));
    const clear = [
      [a.x + 2, a.y + 2],
      [b.x + 2, b.y + 2],
      [b.x + 30, b.y + 20],
      [a.x + a.width - 2, a.y + a.height - 2],
      [b.x + b.width - 2, b.y + b.height - 2],
    ];
    for (const [x, y] of clear) {
      expect(await isDimmed(page, x, y), `${x},${y}`).toBe(false);
    }
    expect(await isDimmed(page, b.x - 5, b.y + b.height - 5)).toBe(true);
    expect(await isDimmed(page, a.x + a.width + 5, a.y + 5)).toBe(true);

    await record(page, "#allowed-b", ["click"]);
    await page.mouse.click(b.x + 30, b.y + 20);
    expect(await log(page)).toEqual(["click@#allowed-b"]);
  });
});

import { expect, test, type Page } from "@playwright/test";
import type { Hints } from "driver.js/hints";
import { box, description, log, openFixture, popover, record, settle, title } from "./harness";

declare global {
  interface Window {
    productHints: Hints;
  }
}

const BEACON_SIZE = 24;
const DIM_PADDING = 10;
const POPOVER_OFFSET = 10;
const ARROW_TIP_INSET = 22;

const PLACEMENTS = [
  ["top", "start"],
  ["top", "center"],
  ["top", "end"],
  ["bottom", "start"],
  ["bottom", "center"],
  ["bottom", "end"],
  ["left", "start"],
  ["left", "center"],
  ["left", "end"],
  ["right", "start"],
  ["right", "center"],
  ["right", "end"],
] as const;

type Box = { x: number; y: number; width: number; height: number };

const beacons = (page: Page) => page.locator(".driver-hint");
const dim = (page: Page) => page.locator(".driver-hint-overlay");
const dismissButton = (page: Page) => page.locator(".driver-popover-next-btn");

const center = (rect: Box) => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 });

function anchorPoint(target: Box, side: string, align: string) {
  const along = (start: number, size: number) => {
    if (align === "start") {
      return start;
    }

    return align === "center" ? start + size / 2 : start + size;
  };

  if (side === "top" || side === "bottom") {
    return { x: along(target.x, target.width), y: side === "top" ? target.y : target.y + target.height };
  }

  return { x: side === "left" ? target.x : target.x + target.width, y: along(target.y, target.height) };
}

const distanceFromTopRight = (page: Page, beaconIndex: number, selector: string) =>
  page.evaluate(
    ({ beaconIndex, selector }) => {
      const beacon = document.querySelectorAll(".driver-hint")[beaconIndex].getBoundingClientRect();
      const target = document.querySelector(selector)!.getBoundingClientRect();

      return Math.hypot(beacon.left + beacon.width / 2 - target.right, beacon.top + beacon.height / 2 - target.top);
    },
    { beaconIndex, selector }
  );

async function expectOnTopRight(page: Page, beaconIndex: number, selector: string) {
  await expect.poll(() => distanceFromTopRight(page, beaconIndex, selector)).toBeLessThan(0.75);
}

const hitAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!element) {
        return "none";
      }

      for (const [selector, name] of [
        [".driver-hint-overlay", "dim"],
        [".driver-popover", "popover"],
        [".driver-hint", "beacon"],
      ]) {
        if (element.closest(selector)) {
          return name;
        }
      }

      return element.id || element.tagName.toLowerCase();
    },
    { x, y }
  );

const scrollPageTo = (page: Page, top: number) => page.evaluate(top => window.scrollTo(0, top), top);

const activeHint = (page: Page) => page.evaluate(() => window.productHints.getActive()?.id ?? null);

async function showSampleHints(page: Page, config: { overlay?: boolean } = {}) {
  await page.evaluate(config => {
    window.productHints = window.driverjs.hints({
      ...config,
      hints: [
        { element: "#two", id: "two", popover: { title: "Two hint", description: "About two" } },
        { element: "#field", id: "field", popover: { title: "Field hint" } },
      ],
      onOpen: (element, hint) => window.log.push(`open:${hint.id}`),
      onDismiss: (element, hint) => window.log.push(`dismiss:${hint.id}`),
    });
    window.productHints.show();
  }, config);
  await expect(beacons(page)).toHaveCount(2);
}

async function openDialog(page: Page) {
  await page.evaluate(() => {
    const dialog = document.createElement("dialog");
    dialog.id = "dialog";
    dialog.style.cssText = "width:360px;padding:24px";
    dialog.innerHTML = `
      <p id="dialog-text">Project settings</p>
      <p><button id="dialog-cancel" type="button">Cancel</button> <button id="dialog-save" type="button">Save</button></p>
    `;
    document.body.appendChild(dialog);
    dialog.showModal();
  });
}

async function showDialogHint(page: Page, config: { overlay?: boolean } = {}) {
  await page.evaluate(config => {
    window.productHints = window.driverjs.hints({
      ...config,
      hints: [{ element: "#dialog-save", id: "save", popover: { title: "In dialog" } }],
    });
    window.productHints.show();
  }, config);
  await expect(beacons(page)).toHaveCount(1);
}

const dialogHome = (page: Page) =>
  page.evaluate(() => {
    const home = (selector: string) => {
      const parent = document.querySelector(selector)?.parentElement;
      if (!parent) {
        return "none";
      }

      return parent === document.body ? "body" : parent.className || parent.id;
    };

    return { beacon: home(".driver-hint"), dim: home(".driver-hint-overlay"), popover: home(".driver-popover") };
  });

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("beacon position", () => {
  test("sits on the top-right corner by default, and on any side, alignment and offset asked for", async ({ page }) => {
    await page.evaluate(placements => {
      window.productHints = window.driverjs.hints({
        hints: [
          { element: "#two" },
          ...placements.map(([side, align]) => ({ element: "#two", beacon: { side, align } })),
          { element: "#two", beacon: { side: "top" as const, align: "end" as const, offsetX: 12, offsetY: -8 } },
          { element: "#two", beacon: { side: "left" as const, align: "center" as const, offsetX: -6, offsetY: 4 } },
        ],
      });
      window.productHints.show();
    }, PLACEMENTS);
    await expect(beacons(page)).toHaveCount(PLACEMENTS.length + 3);

    const target = await box(page.locator("#two"));
    const expected = [
      anchorPoint(target, "top", "end"),
      ...PLACEMENTS.map(([side, align]) => anchorPoint(target, side, align)),
      { x: target.x + target.width + 12, y: target.y - 8 },
      { x: target.x - 6, y: target.y + target.height / 2 + 4 },
    ];

    for (const [index, point] of expected.entries()) {
      const beacon = await box(beacons(page).nth(index));
      expect(beacon.width, `beacon ${index}`).toBeCloseTo(BEACON_SIZE, 0);
      expect(beacon.height, `beacon ${index}`).toBeCloseTo(BEACON_SIZE, 0);
      expect(center(beacon).x, `beacon ${index}`).toBeCloseTo(point.x, 0);
      expect(center(beacon).y, `beacon ${index}`).toBeCloseTo(point.y, 0);
    }
  });

  test("follows its element when the page scrolls, a nested container scrolls and the window resizes", async ({
    page,
  }) => {
    await page.evaluate(() => {
      document.querySelector("#slot")!.innerHTML = `
        <div id="scroller" style="height:120px;width:300px;overflow:auto;border:1px solid #999">
          <div style="height:50px"></div>
          <button id="nested" type="button">Nested</button>
          <div style="height:400px"></div>
        </div>
      `;
      window.productHints = window.driverjs.hints({
        hints: [{ element: "#two" }, { element: "#nested" }, { element: "#side-btn" }],
      });
      window.productHints.show();
    });
    const two = await box(page.locator("#two"));
    await expectOnTopRight(page, 0, "#two");
    await expectOnTopRight(page, 1, "#nested");
    await expectOnTopRight(page, 2, "#side-btn");

    await scrollPageTo(page, 80);
    expect((await box(page.locator("#two"))).y).toBeCloseTo(two.y - 80, 0);
    await expectOnTopRight(page, 0, "#two");
    await expectOnTopRight(page, 1, "#nested");

    const nested = await box(page.locator("#nested"));
    await page.locator("#scroller").evaluate(scroller => {
      scroller.scrollTop = 30;
    });
    expect((await box(page.locator("#nested"))).y).toBeCloseTo(nested.y - 30, 0);
    await expectOnTopRight(page, 1, "#nested");

    const side = await box(page.locator("#side-btn"));
    await page.setViewportSize({ width: 1000, height: 720 });
    await expect.poll(async () => (await box(page.locator("#side-btn"))).x).toBeLessThan(side.x - 200);
    await expectOnTopRight(page, 2, "#side-btn");
    await expectOnTopRight(page, 0, "#two");
  });
});

test.describe("hint popover", () => {
  test("hangs off the beacon with its arrow pointing at the beacon's center", async ({ page }) => {
    await showSampleHints(page);
    await beacons(page).first().click();
    await expect(title(page)).toHaveText("Two hint");
    await expect(popover(page)).toHaveClass(/driver-hint-popover/);
    await expect(dim(page)).toHaveCount(0);

    const beacon = await box(beacons(page).first());
    const pop = await box(popover(page));
    const arrow = await box(page.locator(".driver-popover-arrow"));
    expect(center(arrow).x).toBeCloseTo(center(beacon).x, 0);
    expect(arrow.y + arrow.height).toBeLessThanOrEqual(pop.y + 1);
    expect(pop.x).toBeCloseTo(center(beacon).x - ARROW_TIP_INSET, 0);
    expect(pop.y).toBeCloseTo(beacon.y + beacon.height + POPOVER_OFFSET, 0);
    await expect(beacons(page).first()).toBeVisible();
  });
});

test.describe("hint overlay", () => {
  test("dims the page around the element, hangs the popover off the element and tracks it on scroll", async ({
    page,
  }) => {
    await scrollPageTo(page, 90);
    await showSampleHints(page, { overlay: true });
    await beacons(page).first().click();
    await expect(title(page)).toHaveText("Two hint");
    await expect(dim(page)).toHaveCount(1);
    await expect(beacons(page).first()).toBeHidden();

    const viewport = page.viewportSize()!;
    const cover = await box(dim(page));
    expect(cover.x).toBeLessThanOrEqual(0);
    expect(cover.y).toBeLessThanOrEqual(0);
    expect(cover.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(cover.height).toBeGreaterThanOrEqual(viewport.height - 1);

    const target = await box(page.locator("#two"));
    const middle = center(target);
    const right = target.x + target.width;
    const bottom = target.y + target.height;
    expect(await hitAt(page, middle.x, middle.y)).toBe("two");
    expect(await hitAt(page, target.x - DIM_PADDING + 2, middle.y)).not.toBe("dim");
    expect(await hitAt(page, target.x - DIM_PADDING - 2, middle.y)).toBe("dim");
    expect(await hitAt(page, right + DIM_PADDING - 2, middle.y)).not.toBe("dim");
    expect(await hitAt(page, right + DIM_PADDING + 2, middle.y)).toBe("dim");
    expect(await hitAt(page, middle.x, target.y - DIM_PADDING + 2)).not.toBe("dim");
    expect(await hitAt(page, middle.x, target.y - DIM_PADDING - 2)).toBe("dim");
    expect(await hitAt(page, right + DIM_PADDING + 2, bottom + DIM_PADDING + 2)).toBe("dim");
    expect(await hitAt(page, 5, 5)).toBe("dim");
    expect(await hitAt(page, viewport.width - 30, viewport.height - 30)).toBe("dim");

    const pop = await box(popover(page));
    expect(pop.x).toBeCloseTo(target.x - DIM_PADDING, 0);
    expect(pop.y).toBeCloseTo(bottom + DIM_PADDING + POPOVER_OFFSET, 0);

    await scrollPageTo(page, 0);
    await expect.poll(() => hitAt(page, middle.x, middle.y + 90)).toBe("two");
    expect(await hitAt(page, middle.x, middle.y)).toBe("dim");
    expect(await hitAt(page, middle.x, target.y + 90 - DIM_PADDING - 2)).toBe("dim");
    expect(await hitAt(page, middle.x, target.y + 90 - DIM_PADDING + 2)).not.toBe("dim");
    expect((await box(popover(page))).y).toBeCloseTo(bottom + 90 + DIM_PADDING + POPOVER_OFFSET, 0);

    await page.evaluate(() => window.productHints.close());
    await expect(dim(page)).toHaveCount(0);
    await expect(beacons(page).first()).toBeVisible();
  });

  test("swallows a click on the dimmed page and closes the hint", async ({ page }) => {
    await showSampleHints(page, { overlay: true });
    await record(page, "#three", ["mousedown", "click"]);
    await beacons(page).first().click();
    await expect(popover(page)).toHaveCount(1);

    const three = center(await box(page.locator("#three")));
    expect(await hitAt(page, three.x + 20, three.y)).toBe("dim");
    await page.mouse.click(three.x + 20, three.y);

    await expect(popover(page)).toHaveCount(0);
    await expect(dim(page)).toHaveCount(0);
    await expect(beacons(page)).toHaveCount(2);
    await expect(beacons(page).first()).toBeVisible();
    expect(await activeHint(page)).toBeNull();
    expect(await log(page)).toEqual(["open:two"]);
  });
});

test.describe("beacon visibility", () => {
  test("hides a beacon while its element is out of the viewport, and closes its open hint", async ({ page }) => {
    await page.evaluate(() => {
      window.productHints = window.driverjs.hints({
        hints: [
          { element: "#two", id: "two", popover: { title: "Two hint" } },
          { element: "#far", id: "far", popover: { title: "Far hint" } },
        ],
      });
      window.productHints.show();
    });
    await expect(beacons(page)).toHaveCount(2);
    await expect(beacons(page).first()).toBeVisible();
    await expect(beacons(page).last()).toBeHidden();

    await page.evaluate(() => window.productHints.open("two"));
    await expect(title(page)).toHaveText("Two hint");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expect(popover(page)).toHaveCount(0);
    expect(await activeHint(page)).toBeNull();
    await expect(beacons(page).first()).toBeHidden();
    await expect(beacons(page).first()).toHaveAttribute("aria-expanded", "false");
    await expect(beacons(page).last()).toBeVisible();
    await expectOnTopRight(page, 1, "#far");

    await scrollPageTo(page, 0);
    await expect(beacons(page).first()).toBeVisible();
    await expect(beacons(page).last()).toBeHidden();
    await expectOnTopRight(page, 0, "#two");
    await expect(beacons(page)).toHaveCount(2);
  });
});

test.describe("closing a hint", () => {
  test("stays open on a click inside the popover, closes on a click outside and keeps the beacon", async ({ page }) => {
    await showSampleHints(page);
    await beacons(page).first().click();
    await expect(title(page)).toHaveText("Two hint");

    await description(page).click();
    await settle(page);
    await expect(popover(page)).toHaveCount(1);

    await page.locator("#heading").click();
    await expect(popover(page)).toHaveCount(0);
    await expect(beacons(page)).toHaveCount(2);
    await expect(beacons(page).first()).toHaveAttribute("aria-expanded", "false");
    expect(await activeHint(page)).toBeNull();
    expect(await log(page)).toEqual(["open:two"]);
  });

  test("closes on Escape without dismissing and hands focus back to the beacon", async ({ page }) => {
    await showSampleHints(page);
    await beacons(page).first().click();
    await expect(dismissButton(page)).toBeFocused();

    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    await expect(beacons(page).first()).toBeFocused();
    await expect(beacons(page)).toHaveCount(2);
    expect(await log(page)).toEqual(["open:two"]);

    await page.keyboard.press("Enter");
    await expect(title(page)).toHaveText("Two hint");
    await page.keyboard.press("Enter");
    await expect(popover(page)).toHaveCount(0);
    await expect(beacons(page)).toHaveCount(1);
    expect(await log(page)).toEqual(["open:two", "open:two", "dismiss:two"]);
  });
});

test("a hint without a button keeps focus on its beacon, so Enter toggles it", async ({ page }) => {
  await page.evaluate(() => {
    window.productHints = window.driverjs.hints({
      hints: [{ element: "#two", id: "two", popover: { title: "Two hint", showButton: false } }],
    });
    window.productHints.show();
  });
  await expect(beacons(page)).toHaveCount(1);

  await beacons(page).focus();
  await page.keyboard.press("Enter");
  await expect(title(page)).toHaveText("Two hint");
  await expect(beacons(page)).toBeFocused();

  await page.keyboard.press("Enter");
  await expect(popover(page)).toHaveCount(0);
});

test.describe("after hide()", () => {
  test("nothing reacts to scrolling, resizing, clicks or Escape, and show() starts clean", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));

    await showSampleHints(page);
    await beacons(page).first().click();
    await expect(popover(page)).toHaveCount(1);
    await page.evaluate(() => window.productHints.hide());
    await expect(beacons(page)).toHaveCount(0);
    await expect(popover(page)).toHaveCount(0);

    await scrollPageTo(page, 60);
    await page.setViewportSize({ width: 1100, height: 700 });
    await page.locator("#heading").click();
    await page.keyboard.press("Escape");
    await settle(page);
    await expect(beacons(page)).toHaveCount(0);
    await expect(popover(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.productHints.isVisible())).toBe(false);

    await page.evaluate(() => window.productHints.show());
    await expect(beacons(page)).toHaveCount(2);
    await expectOnTopRight(page, 0, "#two");
    await scrollPageTo(page, 0);
    await expectOnTopRight(page, 0, "#two");

    await beacons(page).first().click();
    await expect(popover(page)).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(["open:two", "open:two"]);
    expect(errors).toEqual([]);
  });
});

test.describe("hints next to a tour", () => {
  test("an open hint closes and the beacons disappear while a tour runs, then come back", async ({ page }) => {
    await showSampleHints(page);
    await beacons(page).first().click();
    await expect(title(page)).toHaveText("Two hint");

    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#intro", popover: { title: "Tour" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Tour");
    await expect(popover(page)).toHaveCount(1);
    expect(await activeHint(page)).toBeNull();
    await expect(beacons(page)).toHaveCount(2);
    await expect(beacons(page).first()).toBeHidden();
    await expect(beacons(page).last()).toBeHidden();

    await page.evaluate(() => window.tour.destroy());
    await expect(popover(page)).toHaveCount(0);
    await expect(beacons(page).first()).toBeVisible();
    await expect(beacons(page).last()).toBeVisible();

    await beacons(page).last().click();
    await expect(title(page)).toHaveText("Field hint");
  });
});

test.describe("hints inside a modal dialog", () => {
  test("put the beacon, dim and popover in one top-layer host above the dialog", async ({ page }) => {
    await openDialog(page);
    await showDialogHint(page, { overlay: true });

    const layer = page.locator("#dialog > .driver-layer");
    await expect(layer).toHaveCount(1);
    await expect(layer).toHaveAttribute("popover", "manual");
    expect(await layer.evaluate(element => element.matches(":popover-open"))).toBe(true);

    const beacon = center(await box(beacons(page)));
    expect(await hitAt(page, beacon.x, beacon.y)).toBe("beacon");
    await beacons(page).click();
    await expect(title(page)).toHaveText("In dialog");
    expect(await dialogHome(page)).toEqual({ beacon: "driver-layer", dim: "driver-layer", popover: "driver-layer" });
    await expect(page.locator(".driver-layer")).toHaveCount(1);

    const save = center(await box(page.locator("#dialog-save")));
    const cancel = await box(page.locator("#dialog-cancel"));
    const text = center(await box(page.locator("#dialog-text")));
    const pop = center(await box(popover(page)));
    expect(await hitAt(page, save.x, save.y)).toBe("dialog-save");
    expect(await hitAt(page, cancel.x + 4, cancel.y + cancel.height / 2)).toBe("dim");
    expect(await hitAt(page, text.x, text.y)).toBe("dim");
    expect(await hitAt(page, 5, 5)).toBe("dim");
    expect(await hitAt(page, pop.x, pop.y)).toBe("popover");

    await dismissButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".driver-layer")).toHaveCount(0);
    await page.locator("#dialog-cancel").click();
  });

  test("remove the host once the hints are hidden", async ({ page }) => {
    await openDialog(page);
    await showDialogHint(page);
    await page.evaluate(() => window.productHints.open("save"));
    await expect(title(page)).toHaveText("In dialog");
    await expect(page.locator("#dialog > .driver-layer")).toHaveCount(1);

    await page.evaluate(() => window.productHints.hide());
    await expect(page.locator(".driver-layer")).toHaveCount(0);

    await page.evaluate(() => {
      window.productHints.show();
      window.productHints.hide();
    });
    await scrollPageTo(page, 40);
    await settle(page);
    await expect(page.locator(".driver-layer")).toHaveCount(0);
  });

  test("keep the host unstyled when the page styles every popover", async ({ page }) => {
    await page.addStyleTag({ content: "html [popover] { background-color: rgb(1, 2, 3); padding: 12px; top: 40px; }" });
    await openDialog(page);
    await showDialogHint(page);

    const styles = await page.locator(".driver-layer").evaluate(element => {
      const computed = getComputedStyle(element);
      return { background: computed.backgroundColor, padding: computed.paddingTop, top: computed.top };
    });
    expect(styles).toEqual({ background: "rgba(0, 0, 0, 0)", padding: "0px", top: "0px" });

    const viewport = page.viewportSize()!;
    const host = await box(page.locator(".driver-layer"));
    expect(host.y).toBe(0);
    expect(host.height).toBe(viewport.height);
    await expectOnTopRight(page, 0, "#dialog-save");
  });

  test("mount inside the dialog itself without the popover API", async ({ page }) => {
    await page.evaluate(() => {
      delete (HTMLElement.prototype as unknown as Record<string, unknown>).showPopover;
    });
    await openDialog(page);
    await showDialogHint(page, { overlay: true });
    await expectOnTopRight(page, 0, "#dialog-save");

    await beacons(page).click();
    await expect(title(page)).toHaveText("In dialog");
    expect(await dialogHome(page)).toEqual({ beacon: "dialog", dim: "dialog", popover: "dialog" });
    await expect(page.locator(".driver-layer")).toHaveCount(0);

    const save = center(await box(page.locator("#dialog-save")));
    const cancel = await box(page.locator("#dialog-cancel"));
    const pop = center(await box(popover(page)));
    expect(await hitAt(page, save.x, save.y)).toBe("dialog-save");
    expect(await hitAt(page, cancel.x + 4, cancel.y + cancel.height / 2)).toBe("dim");
    expect(await hitAt(page, pop.x, pop.y)).toBe("popover");

    await dismissButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    await expect(beacons(page)).toHaveCount(0);
  });
});

test.describe("hints basics", () => {
  test("a hint beacon opens its popover and dismisses", async ({ page }) => {
    await page.evaluate(() => {
      const hints = window.driverjs.hints({
        hints: [{ element: "#two", popover: { title: "Hint", description: "About two" } }],
      });
      hints.show();
    });

    await page.locator(".driver-hint").click();
    await expect(title(page)).toHaveText("Hint");
    await page.locator(".driver-popover button:visible").last().click();
    await expect(popover(page)).toHaveCount(0);
    await expect(page.locator(".driver-hint")).toHaveCount(0);
  });
});

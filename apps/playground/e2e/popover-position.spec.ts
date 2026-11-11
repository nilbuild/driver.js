import { expect, test, type Page } from "@playwright/test";
import { box, near, openFixture, overlay, popover, settle, title, topElementAt } from "./harness";

type Side = "top" | "right" | "bottom" | "left";
type Align = "start" | "center" | "end";
type PopoverOptions = { side?: Side; align?: Align; popoverClass?: string; title?: string; description?: string };
type ConfigOptions = { stagePadding?: number; popoverOffset?: number };

const CENTERED = "left:540px;top:320px;width:200px;height:40px";
const ARROW_INSET = 15;
const ARROW_HALF = 5;

const target = (page: Page) => page.locator("#target");
const arrow = (page: Page) => page.locator(".driver-popover-arrow");

async function placeTarget(page: Page, css: string, position = "fixed") {
  await page.evaluate(
    ({ css, position }) => {
      const element = document.querySelector<HTMLElement>("#target") || document.createElement("div");
      element.id = "target";
      element.style.cssText = `position:${position};background:#cdd;${css}`;
      document.body.appendChild(element);
    },
    { css, position }
  );
}

async function highlightTarget(page: Page, options: PopoverOptions = {}, config: ConfigOptions = {}) {
  await page.evaluate(
    ({ options, config }) => {
      window.tour?.destroy();
      window.tour = window.driverjs.driver({ animate: false, ...config });
      window.tour.highlight({ element: "#target", popover: { title: "Target", description: "Placed", ...options } });
    },
    { options, config }
  );
  await settle(page);
}

async function refresh(page: Page) {
  await page.evaluate(() => window.tour.refresh());
  await settle(page);
}

async function boxes(page: Page) {
  const element = await box(target(page));
  const pop = await box(popover(page));

  return {
    element: { ...element, right: element.x + element.width, bottom: element.y + element.height },
    pop: { ...pop, right: pop.x + pop.width, bottom: pop.y + pop.height },
  };
}

async function arrowCenter(page: Page) {
  const tip = await box(arrow(page));

  return { x: tip.x + tip.width / 2, y: tip.y + tip.height / 2 };
}

const sideClasses = (page: Page) =>
  popover(page).evaluate(element =>
    [...element.classList].filter(name => name.startsWith("driver-popover-side-")).join(" ")
  );

const arrowOffsets = (page: Page) => arrow(page).evaluate(element => [element.style.top, element.style.left]);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("sides and alignment", () => {
  test("puts the popover on the asked side, stage padding plus offset away, with the arrow on the facing edge", async ({
    page,
  }) => {
    await placeTarget(page, CENTERED);

    for (const side of ["top", "bottom", "left", "right"] as const) {
      await highlightTarget(page, { side });
      const { element, pop } = await boxes(page);
      const tip = await box(arrow(page));

      if (side === "top") {
        near(pop.bottom, element.y - 20);
        near(tip.y, pop.bottom);
      }

      if (side === "bottom") {
        near(pop.y, element.bottom + 20);
        near(tip.y + tip.height, pop.y);
      }

      if (side === "left") {
        near(pop.right, element.x - 20);
        near(tip.x, pop.right);
      }

      if (side === "right") {
        near(pop.x, element.right + 20);
        near(tip.x + tip.width, pop.x);
      }

      if (side === "top" || side === "bottom") {
        near(pop.x, element.x - 10);
      } else {
        near(pop.y, element.y - 10);
      }

      await expect(popover(page)).toHaveClass(new RegExp(`driver-popover-side-${side} driver-popover-align-start`));
      await expect(arrow(page)).toHaveClass(`driver-popover-arrow driver-popover-arrow-side-${side}`);
    }
  });

  test("aligns the popover with the start, the center or the end of the element", async ({ page }) => {
    await placeTarget(page, CENTERED);

    for (const align of ["start", "center", "end"] as const) {
      await highlightTarget(page, { side: "top", align });
      const above = await boxes(page);
      if (align === "start") {
        near(above.pop.x, above.element.x - 10);
      }

      if (align === "center") {
        near(above.pop.x + above.pop.width / 2, above.element.x + above.element.width / 2);
      }

      if (align === "end") {
        near(above.pop.right, above.element.right + 10);
      }

      await expect(popover(page)).toHaveClass(new RegExp(`driver-popover-side-top driver-popover-align-${align}`));

      await highlightTarget(page, { side: "left", align });
      const beside = await boxes(page);
      if (align === "start") {
        near(beside.pop.y, beside.element.y - 10);
      }

      if (align === "center") {
        near(beside.pop.y + beside.pop.height / 2, beside.element.y + beside.element.height / 2);
      }

      if (align === "end") {
        near(beside.pop.bottom, beside.element.bottom + 10);
      }

      await expect(popover(page)).toHaveClass(new RegExp(`driver-popover-side-left driver-popover-align-${align}`));
    }
  });

  test("keeps stagePadding plus popoverOffset between the element and the popover", async ({ page }) => {
    await placeTarget(page, CENTERED);

    const cases = [
      { stagePadding: 0, popoverOffset: 10 },
      { stagePadding: 30, popoverOffset: 10 },
      { stagePadding: 10, popoverOffset: 50 },
    ];
    for (const config of cases) {
      await highlightTarget(page, { side: "top" }, config);
      const { element, pop } = await boxes(page);

      near(element.y - pop.bottom, config.stagePadding + config.popoverOffset);
      near(element.x - pop.x, config.stagePadding);
    }
  });
});

test.describe("when the asked side has no room", () => {
  test("falls back to the left side first and shows that side in the classes", async ({ page }) => {
    await placeTarget(page, "left:540px;top:50px;width:200px;height:20px");
    await highlightTarget(page, { side: "top" });

    const { element, pop } = await boxes(page);
    near(pop.right, element.x - 20);
    near(pop.y, element.y - 10);
    expect(await sideClasses(page)).toBe("driver-popover-side-left");
    await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-left/);
  });

  test("drops the old side class when a refresh moves the popover to another side", async ({ page }) => {
    await placeTarget(page, CENTERED);
    await highlightTarget(page, { side: "top" });
    expect(await sideClasses(page)).toBe("driver-popover-side-top");

    await placeTarget(page, "left:5px;right:5px;top:0;height:5px");
    await refresh(page);

    await expect.poll(() => sideClasses(page)).toBe("driver-popover-side-bottom");
    const { element, pop } = await boxes(page);
    near(pop.y, element.bottom + 20);
  });

  test("pins the popover to the bottom center without an arrow when no side fits", async ({ page }) => {
    await placeTarget(page, CENTERED);
    await highlightTarget(page, { side: "left" });
    await expect(arrow(page)).toBeVisible();
    expect((await arrowOffsets(page))[0]).not.toBe("");

    await placeTarget(page, "inset:0");
    await refresh(page);

    await expect(arrow(page)).toHaveClass("driver-popover-arrow driver-popover-arrow-none");
    await expect(arrow(page)).toBeHidden();
    expect(await arrowOffsets(page)).toEqual(["", ""]);

    const viewport = page.viewportSize()!;
    const { pop } = await boxes(page);
    near(pop.x + pop.width / 2, viewport.width / 2);
    near(pop.bottom, viewport.height - 10);
  });
});

test.describe("arrow", () => {
  test("points at the center of a small element whatever the alignment", async ({ page }) => {
    await placeTarget(page, "left:540px;top:320px;width:200px;height:60px");

    for (const align of ["start", "center", "end"] as const) {
      await highlightTarget(page, { side: "left", align });
      const beside = await boxes(page);
      near((await arrowCenter(page)).y, beside.element.y + beside.element.height / 2);
      expect((await arrowOffsets(page))[1]).toBe("");

      await highlightTarget(page, { side: "bottom", align });
      const below = await boxes(page);
      near((await arrowCenter(page)).x, below.element.x + below.element.width / 2);
      expect((await arrowOffsets(page))[0]).toBe("");
    }
  });

  test("stays inside the popover's corners when the element center is past them", async ({ page }) => {
    await placeTarget(page, "left:540px;bottom:10px;width:200px;height:20px");
    await highlightTarget(page, { side: "left" });
    const low = await boxes(page);
    expect(low.element.y + low.element.height / 2).toBeGreaterThan(low.pop.bottom - ARROW_INSET);
    near((await arrowCenter(page)).y, low.pop.bottom - ARROW_INSET - ARROW_HALF);
    await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-left/);

    await placeTarget(page, "left:0;top:320px;width:20px;height:20px");
    await highlightTarget(page, { side: "bottom" });
    const early = await boxes(page);
    expect(early.element.x + early.element.width / 2).toBeLessThan(early.pop.x + ARROW_INSET);
    near((await arrowCenter(page)).x, early.pop.x + ARROW_INSET + ARROW_HALF);
    await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-bottom/);
  });

  test("aims at the middle of the part of the element the popover overlaps", async ({ page }) => {
    await placeTarget(page, "left:540px;top:320px;width:200px;height:400px");
    await highlightTarget(page, { side: "left" });

    const { element, pop } = await boxes(page);
    expect(element.bottom).toBeGreaterThan(pop.bottom);
    near((await arrowCenter(page)).y, (element.y + pop.bottom) / 2);
  });

  test("follows the alignment when the element spans the whole popover edge", async ({ page }) => {
    await placeTarget(page, "left:540px;top:160px;width:200px;height:400px");

    for (const align of ["start", "center", "end"] as const) {
      await highlightTarget(page, { side: "left", align }, { stagePadding: 0 });
      const { pop } = await boxes(page);
      const expected = {
        start: pop.y + ARROW_INSET + ARROW_HALF,
        center: pop.y + pop.height / 2,
        end: pop.bottom - ARROW_INSET - ARROW_HALF,
      };

      near((await arrowCenter(page)).y, expected[align]);
    }
  });

  test("turns to the top or bottom edge when the element scrolls past a side-placed popover", async ({ page }) => {
    await placeTarget(page, "left:540px;top:900px;width:200px;height:100px", "absolute");

    for (const side of ["left", "right"] as const) {
      await highlightTarget(page, { side });
      await expect(arrow(page)).toHaveClass(new RegExp(`driver-popover-arrow-side-${side}`));

      await page.evaluate(() => window.scrollTo(0, 1050));
      await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-bottom/);
      const above = await boxes(page);
      const upTip = await box(arrow(page));
      expect(above.element.bottom).toBeLessThan(above.pop.y);
      near(upTip.y + upTip.height, above.pop.y);
      const farCorner =
        side === "left" ? above.pop.right - ARROW_INSET - ARROW_HALF : above.pop.x + ARROW_INSET + ARROW_HALF;
      near(upTip.x + upTip.width / 2, farCorner);
      expect((await arrowOffsets(page))[0]).toBe("");

      await page.evaluate(() => window.scrollTo(0, 100));
      await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-top/);
      const below = await boxes(page);
      const downTip = await box(arrow(page));
      expect(below.element.y).toBeGreaterThan(below.pop.bottom);
      near(downTip.y, below.pop.bottom);
    }
  });

  test("turns to the left or right edge when the element is clear of a popover placed above or below", async ({
    page,
  }) => {
    await placeTarget(page, "left:calc(100vw - 8px);top:320px;width:40px;height:40px");
    for (const side of ["top", "bottom"] as const) {
      await highlightTarget(page, { side });
      await expect(popover(page)).toHaveClass(new RegExp(`driver-popover-side-${side}`));
      await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-left/);

      const { element, pop } = await boxes(page);
      const tip = await box(arrow(page));
      expect(element.x).toBeGreaterThanOrEqual(pop.right);
      near(tip.x, pop.right);
      const nearCorner = side === "top" ? pop.bottom - ARROW_INSET - ARROW_HALF : pop.y + ARROW_INSET + ARROW_HALF;
      near(tip.y + tip.height / 2, nearCorner);
    }

    await placeTarget(page, "left:-30px;top:320px;width:38px;height:40px");
    await highlightTarget(page, { side: "bottom" });
    await expect(arrow(page)).toHaveClass(/driver-popover-arrow-side-right/);

    const { element, pop } = await boxes(page);
    const tip = await box(arrow(page));
    expect(element.right).toBeLessThanOrEqual(pop.x);
    near(tip.x + tip.width, pop.x);
  });

  test("is centered on a popover too small for the corner insets, and never gets a negative offset", async ({
    page,
  }) => {
    await page.addStyleTag({
      content: `
        .driver-popover.tiny { min-width: 0; width: 30px; padding: 0; }
        .driver-popover.collapsed { display: none !important; }
      `,
    });
    await placeTarget(page, CENTERED);

    await highlightTarget(page, { side: "bottom", popoverClass: "tiny", title: "T", description: "" });
    const { pop } = await boxes(page);
    near(pop.width, 30);
    near((await arrowCenter(page)).x, pop.x + pop.width / 2);

    await highlightTarget(page, { side: "bottom", popoverClass: "collapsed" });
    const offsets = (await arrowOffsets(page)).filter(Boolean);
    expect(offsets).toEqual(["0px"]);
  });

  test("is hidden for a popover without an element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({ animate: false });
      window.tour.highlight({ popover: { title: "Floating" } });
    });

    await expect(popover(page)).toBeVisible();
    await expect(arrow(page)).toHaveClass("driver-popover-arrow driver-popover-arrow-none");
    await expect(arrow(page)).toBeHidden();
  });
});

test.describe("repositioning", () => {
  test("moves the popover again when a lazy image inside it loads", async ({ page }) => {
    let release = () => {};
    const isReleased = new Promise<void>(resolve => {
      release = resolve;
    });
    await page.route("**/lazy-image.svg", async route => {
      await isReleased;
      await route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#888"/></svg>`,
      });
    });

    await placeTarget(page, CENTERED);
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        onPopoverRender: popover => {
          const image = document.createElement("img");
          image.id = "lazy";
          image.src = "/lazy-image.svg";
          image.style.display = "block";
          popover.description.appendChild(image);
        },
      });
      window.tour.highlight({
        element: "#target",
        popover: { title: "Target", description: "With image", side: "top" },
      });
    });
    await settle(page);

    const before = await boxes(page);
    near(before.pop.bottom, before.element.y - 20);

    release();
    await expect.poll(() => page.locator("#lazy").evaluate((image: HTMLImageElement) => image.naturalHeight)).toBe(120);
    await settle(page);

    const after = await boxes(page);
    expect(after.pop.height).toBeGreaterThan(before.pop.height + 100);
    near(after.pop.bottom, after.element.y - 20);
  });

  test("follows the element when the viewport is resized", async ({ page }) => {
    await placeTarget(page, "right:300px;bottom:300px;width:200px;height:40px");
    await highlightTarget(page, { side: "top" });
    const before = await boxes(page);

    await page.setViewportSize({ width: 1000, height: 600 });
    await expect.poll(async () => (await boxes(page)).pop.x).not.toBe(before.pop.x);
    await settle(page);

    const { element, pop } = await boxes(page);
    near(element.right, 700);
    near(pop.bottom, element.y - 20);
    near(pop.x, element.x - 10);
  });
});

async function startFollowing(page: Page, element: string, side: "bottom" | "right") {
  await page.evaluate(
    ({ element, side }) => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        steps: [{ element, popover: { title: "Here", side } }],
      });
      window.tour.drive();
    },
    { element, side }
  );
  await expect(overlay(page)).toHaveCount(1);
  await expect(title(page)).toHaveText("Here");
  await settle(page);
}

async function placementOf(page: Page, selector: string) {
  const target = await box(page.locator(selector));
  const pop = await box(popover(page));

  return {
    center: [target.x + target.width / 2, target.y + target.height / 2] as const,
    popoverOffset: [Math.round(pop.x - target.x), Math.round(pop.y - target.y)],
  };
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("the cutout and the popover follow the element", () => {
  test("when the window is resized", async ({ page }) => {
    await startFollowing(page, "#side-btn", "bottom");
    const before = await placementOf(page, "#side-btn");
    expect(await topElementAt(page, ...before.center)).toBe("side-btn");

    await page.setViewportSize({ width: 1500, height: 720 });
    await expect
      .poll(async () => (await placementOf(page, "#side-btn")).center[0])
      .toBeGreaterThan(before.center[0] + 200);
    const after = await placementOf(page, "#side-btn");

    await expect.poll(() => topElementAt(page, ...after.center)).toBe("side-btn");
    expect(await topElementAt(page, ...before.center)).toBe("overlay");
    await expect.poll(async () => (await placementOf(page, "#side-btn")).popoverOffset).toEqual(before.popoverOffset);
  });

  test("when the page is scrolled", async ({ page }) => {
    await startFollowing(page, "#one", "right");
    const before = await placementOf(page, "#one");
    expect(await topElementAt(page, ...before.center)).toBe("one");

    await page.mouse.move(700, 500);
    await page.mouse.wheel(0, 100);
    await expect.poll(async () => (await placementOf(page, "#one")).center[1]).toBe(before.center[1] - 100);
    const after = await placementOf(page, "#one");

    await expect.poll(() => topElementAt(page, ...after.center)).toBe("one");
    expect(await topElementAt(page, ...before.center)).toBe("overlay");
    await expect.poll(async () => (await placementOf(page, "#one")).popoverOffset).toEqual(before.popoverOffset);
  });
});

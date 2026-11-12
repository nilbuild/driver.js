import { expect, test } from "@playwright/test";
import {
  box,
  description,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  prevButton,
  settle,
  title,
  topElementAt,
} from "./harness";

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("basic tour", () => {
  test.beforeEach(async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        showProgress: true,
        steps: [
          { element: "#intro", popover: { title: "Intro", description: "First", side: "bottom", align: "start" } },
          { element: "#two", popover: { title: "Two", description: "Second", side: "right" } },
          { popover: { title: "Modal", description: "Centered" } },
        ],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Intro");
  });

  test("dims the page, cuts the element out and puts the popover next to it", async ({ page }) => {
    const viewport = page.viewportSize()!;
    const svg = await box(overlay(page));
    expect(svg.width).toBeGreaterThanOrEqual(viewport.width - 1);
    expect(svg.height).toBeGreaterThanOrEqual(viewport.height - 1);

    const target = await box(page.locator("#intro"));
    const pop = await box(popover(page));
    expect(pop.y).toBeGreaterThanOrEqual(target.y + target.height);
    expect(pop.y - (target.y + target.height)).toBeLessThan(40);
    expect(Math.abs(pop.x - (target.x - 10))).toBeLessThan(2);

    await expect.poll(() => topElementAt(page, target.x + 5, target.y + target.height / 2)).toBe("intro");
    expect(await topElementAt(page, viewport.width - 5, viewport.height - 5)).toBe("overlay");
    await expect(page.locator(".driver-popover-progress-text")).toHaveText("1 of 3");
    await expect(prevButton(page)).toBeDisabled();
  });

  test("moves with next and previous and keeps one popover and overlay", async ({ page }) => {
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Two");

    const target = await box(page.locator("#two"));
    const pop = await box(popover(page));
    expect(pop.x).toBeGreaterThanOrEqual(target.x + target.width);
    await expect(page.locator("#two")).toHaveClass(/driver-active-element/);
    await expect(page.locator("#intro")).not.toHaveClass(/driver-active-element/);

    await prevButton(page).click();
    await expect(title(page)).toHaveText("Intro");
    await expect(popover(page)).toHaveCount(1);
    await expect(overlay(page)).toHaveCount(1);
  });

  test("centers a step without an element", async ({ page }) => {
    await page.evaluate(() => window.tour.moveTo(2));
    await expect(title(page)).toHaveText("Modal");

    const viewport = page.viewportSize()!;
    const pop = await box(popover(page));
    expect(Math.abs(pop.x + pop.width / 2 - viewport.width / 2)).toBeLessThan(2);
    expect(Math.abs(pop.y + pop.height / 2 - viewport.height / 2)).toBeLessThan(2);
    await expect(nextButton(page)).toHaveText("Done");
  });

  test("finishes on done and cleans the page up", async ({ page }) => {
    await page.evaluate(() => window.tour.moveTo(2));
    await nextButton(page).click();

    await expect(popover(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.body.className)).toBe("");
    expect(await page.evaluate(() => document.querySelectorAll("[class*=driver-]").length)).toBe(0);
  });

  test("scrolls an off-screen step into view", async ({ page }) => {
    await page.evaluate(() => {
      window.tour.setConfig({
        animate: false,
        steps: [{ element: "#far", popover: { title: "Far" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Far");
    await expect(page.locator("#far")).toBeInViewport();
    await expect(popover(page)).toBeInViewport();
  });
});

test.describe("public methods", () => {
  test("highlight() shows one element without tour buttons", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({ animate: false });
      window.tour.highlight({ element: "#two", popover: { title: "Solo", description: "Just this" } });
    });
    await expect(title(page)).toHaveText("Solo");
    await expect(description(page)).toHaveText("Just this");
    await expect(nextButton(page)).toBeHidden();
    await expect(page.locator(".driver-popover-footer")).toBeHidden();
    await expect(overlay(page)).toHaveCount(1);

    const target = await box(page.locator("#two"));
    await expect.poll(() => topElementAt(page, target.x + 4, target.y + 4)).toBe("two");

    await page.evaluate(() => window.tour.highlight({ element: "#intro", popover: { title: "Other" } }));
    await expect(title(page)).toHaveText("Other");
    await expect(popover(page)).toHaveCount(1);
    await settle(page);

    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
  });

  test("setSteps during a tour starts over cleanly", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#intro", popover: { title: "Old" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Old");

    await page.evaluate(() => {
      window.tour.setSteps([
        { element: "#two", popover: { title: "New" } },
        { element: "#three", popover: { title: "Newer" } },
      ]);
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("New");
    await expect(popover(page)).toHaveCount(1);
    await expect(overlay(page)).toHaveCount(1);
    await nextButton(page).click();
    await expect(title(page)).toHaveText("Newer");

    await page.evaluate(() => window.tour.destroy());
    await expect(popover(page)).toHaveCount(0);
    await expect(overlay(page)).toHaveCount(0);
    expect(await page.evaluate(() => document.querySelectorAll("[class*=driver-]").length)).toBe(0);
  });

  test("moveNext() from inside onHighlighted lands on the next step", async ({ page }) => {
    await page.evaluate(() => {
      let hasSkipped = false;
      window.tour = window.driverjs.driver({
        animate: false,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
          if (!hasSkipped) {
            hasSkipped = true;
            window.tour.moveNext();
          }
        },
        steps: [
          { element: "#intro", popover: { title: "A" } },
          { element: "#two", popover: { title: "B" } },
          { element: "#three", popover: { title: "C" } },
        ],
      });
      window.tour.drive();
    });

    await expect(title(page)).toHaveText("B");
    await expect.poll(() => log(page)).toEqual(["highlighted A", "highlighted B"]);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("C");
    await expect(popover(page)).toHaveCount(1);
  });

  test("destroy() from inside onHighlightStarted and onHighlighted leaves nothing behind", async ({ page }) => {
    for (const hook of ["onHighlightStarted", "onHighlighted"] as const) {
      await page.evaluate(hook => {
        window.tour = window.driverjs.driver({
          animate: false,
          [hook]: () => window.tour.destroy(),
          steps: [{ element: "#intro", popover: { title: "A" } }],
        });
        window.tour.drive();
      }, hook);
      await settle(page);

      await expect(popover(page)).toHaveCount(0);
      await expect(overlay(page)).toHaveCount(0);
      expect(await page.evaluate(() => document.querySelectorAll("[class*=driver-]").length)).toBe(0);
    }
  });
});

test("moveTo on a driver that is not running starts the tour, and destroy leaves a clean page", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      steps: [
        { element: "#one", popover: { title: "First" } },
        { element: "#two", popover: { title: "Second" } },
      ],
    });
    window.tour.moveTo(1);
  });

  await expect(title(page)).toHaveText("Second");
  await expect(overlay(page)).toHaveCount(1);
  expect(
    await page.evaluate(() => [window.tour.isActive(), document.body.classList.contains("driver-active")])
  ).toEqual([true, true]);
  await page.keyboard.press("ArrowLeft");
  await expect(title(page)).toHaveText("First");

  await page.evaluate(() => window.tour.destroy());
  await expect(popover(page)).toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => [document.body.className, document.querySelectorAll("[class*=driver-]").length])
  ).toEqual(["", 0]);
  await page.locator("#three").click();
});

test("setSteps on a running tour ends it and leaves nothing on the page", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      onDestroyed: () => window.log.push("destroyed"),
      steps: [{ element: "#one", popover: { title: "Old" } }],
    });
    window.tour.drive();
  });
  await expect(overlay(page)).toHaveCount(1);

  await page.evaluate(() => window.tour.setSteps([{ element: "#two", popover: { title: "New" } }]));
  await expect(popover(page)).toHaveCount(0);
  await expect(overlay(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => [window.tour.isActive(), document.querySelectorAll("[class*=driver-]").length])
  ).toEqual([false, 0]);
  expect(await log(page)).toEqual([]);
  await page.locator("#three").click();

  await page.evaluate(() => window.tour.drive());
  await expect(title(page)).toHaveText("New");
});

test("plain CSS can hide popover parts without !important", async ({ page }) => {
  await page.evaluate(() => {
    const style = document.createElement("style");
    style.textContent = ".driver-popover-progress-text, .driver-popover-prev-btn:disabled { display: none; }";
    document.head.appendChild(style);

    window.tour = window.driverjs.driver({
      animate: false,
      showProgress: true,
      steps: [
        { element: "#one", popover: { title: "One" } },
        { element: "#two", popover: { title: "Two" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("One");

  await expect(page.locator(".driver-popover-progress-text")).toBeHidden();
  await expect(page.locator(".driver-popover-prev-btn")).toBeHidden();
  await expect(page.locator(".driver-popover-next-btn")).toBeVisible();
});

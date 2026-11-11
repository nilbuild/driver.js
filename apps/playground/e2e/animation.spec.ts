import { expect, test, type Page } from "@playwright/test";
import { activeIndex, box, log, nextButton, openFixture, overlay, popover, title, topElementAt } from "./harness";

const bodyDuration = (page: Page) =>
  page.evaluate(() => document.body.style.getPropertyValue("--driver-animation-duration"));

const start = (page: Page, duration?: number) =>
  page.evaluate(duration => {
    window.tour = window.driverjs.driver({
      ...(duration ? { duration } : {}),
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#three", popover: { title: "Three" } },
      ],
    });
    window.tour.drive();
  }, duration);

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("animation duration", () => {
  test("reaches the overlay and popover fade through a custom property, and goes with the tour", async ({ page }) => {
    await start(page, 1200);
    expect(await bodyDuration(page)).toBe("1200ms");
    await expect(overlay(page)).toHaveCSS("animation-duration", "1.2s");
    await expect(popover(page)).toHaveCSS("animation-duration", "1.2s");
    await expect(overlay(page)).toHaveCSS("animation-name", "animate-fade-in");

    await page.evaluate(() => window.tour.destroy());
    expect(await bodyDuration(page)).toBe("");

    await start(page);
    expect(await bodyDuration(page)).toBe("400ms");
    await expect(overlay(page)).toHaveCSS("animation-duration", "0.4s");
  });
});

test.describe("animated stage transition", () => {
  test("slides the cutout from one element to the next and settles on it", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        duration: 400,
        stagePadding: 0,
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", popover: { title: "Intro" } },
          { element: "#three", popover: { title: "Three" } },
        ],
      });
      window.tour.drive();
    });
    await expect.poll(() => log(page)).toEqual(["highlighted Intro"]);
    expect(await activeIndex(page)).toBe(0);

    await page.evaluate(() => {
      const path = document.querySelector(".driver-overlay path")!;
      const frames: number[] = [];
      Object.assign(window, { frames });
      new MutationObserver(() => {
        frames.push(
          Number(
            path
              .getAttribute("d")!
              .split("Z")[1]
              .match(/M\S+,(\S+) /)![1]
          )
        );
      }).observe(path, { attributes: true, attributeFilter: ["d"] });

      window.tour.moveNext();
    });

    await expect.poll(() => log(page)).toEqual(["highlighted Intro", "highlighted Three"]);
    await expect(title(page)).toHaveText("Three");
    await expect(popover(page)).toBeVisible();
    expect(await activeIndex(page)).toBe(1);
    expect(await page.evaluate(() => window.tour.getState("__activeStep")?.popover?.title)).toBe("Three");

    const from = await box(page.locator("#intro"));
    const to = await box(page.locator("#three"));
    const frames = await page.evaluate(() => (window as unknown as { frames: number[] }).frames);
    const between = frames.filter(y => y > from.y + 1 && y < to.y - 1);
    expect(between.length).toBeGreaterThan(0);
    expect([...frames].sort((a, b) => a - b)).toEqual(frames);
    expect(Math.abs(frames[frames.length - 1] - to.y)).toBeLessThan(2);

    await expect.poll(() => topElementAt(page, to.x + 5, to.y + 5)).toBe("three");
    expect(await topElementAt(page, from.x + 5, from.y + 5)).toBe("overlay");
  });
});

test("an animated tour moves the cutout and shows the next popover", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      duration: 150,
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#two", popover: { title: "Two" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("Intro");
  await nextButton(page).click();
  await expect(title(page)).toHaveText("Two");
  await expect(popover(page)).toBeVisible();

  const target = await box(page.locator("#two"));
  await expect.poll(() => topElementAt(page, target.x + 5, target.y + 5)).toBe("two");
  expect(await page.evaluate(() => document.body.classList.contains("driver-fade"))).toBe(true);
});

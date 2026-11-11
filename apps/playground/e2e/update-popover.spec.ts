import { expect, test, type Page } from "@playwright/test";
import { box, description, log, nextButton, openFixture, overlay, popover, settle, title } from "./harness";

const instruction = (page: Page) => page.locator(".driver-popover-instruction");
const NUDGE_CLASS = /driver-popover-nudge/;

const feedback = (page: Page) => page.locator(".driver-popover-feedback");

const farthestShake = (page: Page) => page.evaluate(() => Number(document.documentElement.dataset.shake));

async function startActionTour(page: Page) {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      steps: [
        { element: "#one", popover: { title: "Act", description: "Why", instruction: "Click One." } },
        { element: "#intro", popover: { title: "After" } },
      ],
    });
    window.tour.drive();
  });
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);

  await page.evaluate(() => {
    const wrapper = document.querySelector(".driver-popover")!;
    const home = wrapper.getBoundingClientRect().x;
    document.documentElement.dataset.shake = "0";
    document.addEventListener("animationend", event => {
      window.log.push(`${event.animationName} ended, nudged: ${wrapper.classList.contains("driver-popover-nudge")}`);
    });

    const sample = () => {
      const offset = Math.abs(wrapper.getBoundingClientRect().x - home);
      document.documentElement.dataset.shake = String(Math.max(Number(document.documentElement.dataset.shake), offset));
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("updatePopover", () => {
  test("leaves focus where it is, and moves it to the popover only when the focused control goes away", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#intro", popover: { title: "Intro" } },
          { element: "#field", popover: { title: "Field", description: "Type here." } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Field");

    await page.locator("#field").click();
    await page.keyboard.type("ab");
    await page.evaluate(() => window.tour.updatePopover({ description: "Keep typing." }));
    await expect(description(page)).toHaveText("Keep typing.");
    await expect(page.locator("#field")).toBeFocused();
    await page.keyboard.type("c");
    await expect(page.locator("#field")).toHaveValue("abc");

    await nextButton(page).focus();
    await page.evaluate(() => window.tour.updatePopover({ description: "Still on the button." }));
    await expect(nextButton(page)).toBeFocused();

    await page.evaluate(() => window.tour.updatePopover({ showButtons: [] }));
    await expect(nextButton(page)).toBeHidden();
    await expect(popover(page)).toBeFocused();

    await page.evaluate(() => window.tour.updatePopover({ description: `<input id="answer" />` }));
    await page.locator("#answer").click();
    await page.keyboard.type("42");
    await expect(page.locator("#answer")).toBeFocused();
    await page.evaluate(() => window.tour.updatePopover({ description: "Wrong answer, try again." }));
    await expect(description(page)).toHaveText("Wrong answer, try again.");
    await expect(popover(page)).toBeFocused();
  });

  test("a patch survives a window resize, with the popover still next to the element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#side-btn", popover: { title: "Side", description: "Original", side: "bottom" } }],
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("Side");
    await page.evaluate(() => window.tour.updatePopover({ title: "Changed", popoverClass: "is-wrong" }));
    await settle(page);
    const before = await box(page.locator("#side-btn"));

    await page.setViewportSize({ width: 900, height: 600 });
    await expect.poll(async () => (await box(page.locator("#side-btn"))).x).toBeLessThan(before.x);
    await expect
      .poll(async () => {
        const target = await box(page.locator("#side-btn"));
        const pop = await box(popover(page));

        return pop.x < target.x + target.width && pop.x + pop.width > target.x && pop.y >= target.y + target.height;
      })
      .toBe(true);

    await expect(title(page)).toHaveText("Changed");
    await expect(description(page)).toHaveText("Original");
    await expect(popover(page)).toHaveClass(/is-wrong/);
  });
});

test.describe("nudge", () => {
  test("shakes the popover and clears itself when the animation ends, keeping the message through the library's own nudges", async ({
    page,
  }) => {
    await startActionTour(page);

    await page.evaluate(() => window.tour.nudge("Not that one."));
    await expect(popover(page)).toHaveClass(NUDGE_CLASS);
    await expect(popover(page)).toHaveCSS("animation-name", "driver-nudge-shake");
    await expect.poll(() => log(page)).toEqual(["driver-nudge-shake ended, nudged: false"]);
    expect(await farthestShake(page)).toBeGreaterThan(2);
    await expect(popover(page)).toHaveCSS("animation-name", "none");

    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveClass(NUDGE_CLASS);
    await expect(feedback(page)).toHaveText("Not that one.");
    await expect(feedback(page)).toBeVisible();
    await expect.poll(() => log(page)).toHaveLength(2);
    await expect(popover(page)).not.toHaveClass(NUDGE_CLASS);
    await expect(title(page)).toHaveText("Act");
  });

  test("flashes instead of shaking with reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await startActionTour(page);

    await page.evaluate(() => window.tour.nudge());
    await expect(popover(page)).toHaveClass(NUDGE_CLASS);
    await expect(popover(page)).toHaveCSS("animation-name", "driver-nudge-flash");
    await expect.poll(() => log(page)).toEqual(["driver-nudge-flash ended, nudged: false"]);
    expect(await farthestShake(page)).toBe(0);
  });
});

test.describe("nudge with a message", () => {
  test("a message shows a feedback line, shakes, and goes with the next nudge or step", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#one",
            advanceOn: "click",
            popover: { title: "Act", description: "Why", instruction: "Click One." },
          },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(instruction(page)).toHaveText("Click One.");
    const before = await box(popover(page));

    await page.evaluate(() => window.tour.nudge("Not that one."));
    await expect(feedback(page)).toHaveText("Not that one.");
    await expect(feedback(page)).toBeVisible();
    await expect(popover(page)).toHaveClass(/driver-popover-nudge/);
    await expect(instruction(page)).toHaveText("Click One.");
    await expect(page.locator(".driver-popover-description")).toHaveText("Why");
    await expect(page.locator(".driver-live-region")).toHaveText("Not that one.");

    const row = await box(feedback(page));
    const action = await box(instruction(page));
    expect(row.y).toBeGreaterThanOrEqual(action.y + action.height);
    await expect(popover(page)).not.toHaveClass(/driver-popover-nudge/, { timeout: 2000 });
    const grown = await box(popover(page));
    expect(grown.height).toBeGreaterThan(before.height);

    await page.evaluate(() => window.tour.nudge());
    await expect(feedback(page)).toBeHidden();

    await page.evaluate(() => window.tour.nudge("Again"));
    await page.locator("#one").click();
    await expect(title(page)).toHaveText("After");
    await expect(feedback(page)).toHaveCount(0);
  });
});

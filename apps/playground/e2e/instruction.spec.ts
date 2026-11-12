import { expect, test, type Page } from "@playwright/test";
import {
  activeIndex,
  box,
  closeButton,
  log,
  nextButton,
  openFixture,
  overlay,
  popover,
  prevButton,
  record,
  settle,
  title,
} from "./harness";

const indicator = (page: Page) => page.locator(".driver-popover-instruction-indicator");
const NUDGE_CLASS = /driver-popover-nudge/;

const instruction = (page: Page) => page.locator(".driver-popover-instruction");

async function expectNudge(page: Page, act: () => Promise<void>) {
  await act();
  await expect(popover(page)).toHaveClass(NUDGE_CLASS);
  await expect(popover(page)).not.toHaveClass(NUDGE_CLASS, { timeout: 2000 });
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("instruction steps", () => {
  test("nudge on ArrowRight and on an overlay click that would close, even without a Next button", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        showButtons: ["close"],
        overlayClickBehavior: "close",
        onNextClick: () => {
          window.log.push("onNextClick");
        },
        steps: [
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(instruction(page)).toHaveText("Click One.");
    await expect(nextButton(page)).toBeHidden();
    await settle(page);

    await expectNudge(page, () => page.keyboard.press("ArrowRight"));
    await expectNudge(page, () => page.mouse.click(5, 5));

    await expect(title(page)).toHaveText("Act");
    expect(await page.evaluate(() => window.tour.isActive())).toBe(true);
    expect(await activeIndex(page)).toBe(0);
    expect(await log(page)).toEqual([]);
  });

  test("stay quiet on Next and ArrowRight while the popover waits for the next element", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#later", waitForElement: 30000, popover: { title: "Later" } },
        ],
      });
      window.tour.drive();
    });
    await expect(instruction(page)).toHaveText("Click One.");
    await page.evaluate(() => window.tour.moveNext());
    await expect(popover(page)).toHaveClass(/driver-popover-waiting/);

    await nextButton(page).click({ force: true });
    await page.keyboard.press("ArrowRight");
    await settle(page);

    await expect(popover(page)).not.toHaveClass(NUDGE_CLASS);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(0);
  });

  test("leave ArrowLeft, Previous, Close and the read steps around them working as usual", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "nextStep",
        steps: [
          { element: "#intro", popover: { title: "Read" } },
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(1);
    });
    await expect(title(page)).toHaveText("Act");
    await settle(page);

    await page.keyboard.press("ArrowLeft");
    await expect(title(page)).toHaveText("Read");
    await settle(page);

    await page.evaluate(() => window.tour.updatePopover({ instruction: "Now click Intro." }));
    await expect(instruction(page)).toHaveCount(0);
    await expect(popover(page)).not.toHaveClass(/driver-popover-has-instruction/);
    await page.keyboard.press("ArrowRight");
    await expect(title(page)).toHaveText("Act");
    await settle(page);

    await prevButton(page).click();
    await expect(title(page)).toHaveText("Read");
    await settle(page);

    await page.mouse.click(5, 5);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);

    await closeButton(page).click();
    await expect(popover(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(false);
  });

  test("on a single highlight are a plain line, and an overlay click closes as usual", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({ animate: false });
      window.tour.highlight({ element: "#one", popover: { title: "Hi", instruction: "Click it." } });
    });
    await expect(instruction(page)).toHaveText("Click it.");
    await expect(page.locator(".driver-popover-instruction-indicator")).toBeHidden();
    await expect(page.locator(".driver-popover-footer")).toBeHidden();
    await expect(overlay(page)).toHaveCount(1);

    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveCount(0);
    expect(await page.evaluate(() => window.tour.isActive())).toBe(false);
  });
});

test.describe("instruction steps while animating", () => {
  const start = async (page: Page, index: number) => {
    await page.evaluate(index => {
      window.tour = window.driverjs.driver({
        duration: 1000,
        overlayClickBehavior: "nextStep",
        onHighlighted: (_element, step) => {
          window.log.push(`highlighted ${step.popover?.title}`);
        },
        steps: [
          { element: "#intro", popover: { title: "Read" } },
          { element: "#one", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "Last" } },
        ],
      });
      window.tour.drive(index);
    }, index);
    await expect(overlay(page)).toHaveCount(1);
  };

  test("an overlay click does not skip an action step that is still animating in", async ({ page }) => {
    await start(page, 1);

    await page.mouse.click(5, 5);
    expect(await log(page)).toEqual([]);
    expect(await activeIndex(page)).toBe(1);

    await expect.poll(() => log(page)).toEqual(["highlighted Act"]);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);
  });

  test("an overlay click does not skip an action step during the move from a read step", async ({ page }) => {
    await start(page, 0);
    await expect.poll(() => log(page)).toEqual(["highlighted Read"]);

    await page.evaluate(() => window.tour.moveNext());
    await page.mouse.click(5, 5);
    expect(await log(page)).toEqual(["highlighted Read"]);
    expect(await activeIndex(page)).toBe(1);

    await expect.poll(() => log(page)).toEqual(["highlighted Read", "highlighted Act"]);
    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveClass(NUDGE_CLASS);
    await expect(title(page)).toHaveText("Act");
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("advanceDelay", () => {
  test("ignores Next, ArrowRight and the overlay during the pause, without a nudge", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        advanceDelay: 1500,
        overlayClickBehavior: "nextStep",
        onNextClick: (_element, step) => {
          window.log.push(`onNextClick ${step.popover?.title}`);
          window.tour.moveNext();
        },
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", popover: { title: "After" } },
          { element: "#intro", popover: { title: "Last" } },
        ],
      });
      window.tour.drive();
      new MutationObserver(() => {
        if (document.querySelector(".driver-popover-nudge")) {
          window.log.push("nudged");
        }
      }).observe(document.body, { attributes: true, attributeFilter: ["class"], subtree: true });
    });
    await expect(instruction(page)).toHaveText("Click One.");

    await page.locator("#one").click();
    await expect(popover(page)).toHaveClass(/driver-popover-instruction-done/);
    await nextButton(page).click({ force: true });
    await page.keyboard.press("ArrowRight");
    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Act");

    await expect(title(page)).toHaveText("After", { timeout: 4000 });
    await settle(page);
    expect(await log(page)).toEqual(["onNextClick Act"]);
    expect(await activeIndex(page)).toBe(1);
  });
});

test.describe("instruction steps as rendered", () => {
  test("show the instruction with its dot and a disabled-looking Next, and can't be skipped", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "nextStep",
        onNextClick: (_element, step) => {
          window.log.push(`onNextClick ${step.popover?.title}`);
          window.tour.moveNext();
        },
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click <b>One</b>." } },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await expect(instruction(page)).toHaveText("Click One.");
    await expect(popover(page)).toHaveClass(/driver-popover-has-instruction/);
    await expect(nextButton(page)).toBeVisible();
    await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");
    expect(await nextButton(page).evaluate(button => (button as HTMLButtonElement).disabled)).toBe(false);
    await expect(nextButton(page)).toHaveCSS("color", "rgb(163, 163, 163)");

    const row = await box(instruction(page));
    const dot = await box(indicator(page));
    const text = await box(page.locator(".driver-popover-instruction-text"));
    expect(dot.x).toBeGreaterThanOrEqual(text.x + text.width);
    expect(dot.x + dot.width).toBeLessThanOrEqual(row.x + row.width);
    await expect(indicator(page)).toHaveCSS("animation-name", "driver-instruction-pulse");
    await expect(indicator(page)).toHaveAttribute("aria-hidden", "true");

    const nudged = async (act: () => Promise<void>) => {
      await act();
      await expect(popover(page)).toHaveClass(/driver-popover-nudge/);
      await expect(popover(page)).not.toHaveClass(/driver-popover-nudge/, { timeout: 2000 });
      await expect(title(page)).toHaveText("Act");
    };
    await nudged(() => nextButton(page).click({ force: true }));
    await nudged(async () => {
      await nextButton(page).focus();
      await page.keyboard.press("Enter");
    });
    await nudged(() => page.keyboard.press("Space"));
    await nudged(() => page.keyboard.press("ArrowRight"));
    await nudged(() => page.mouse.click(5, 5));
    expect(await log(page)).toEqual([]);

    await page.locator("#one").click();
    await expect(title(page)).toHaveText("After");
    expect(await log(page)).toEqual(["onNextClick Act"]);
  });

  test("collapse the footer when there is no next button to show", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        showButtons: ["close"],
        steps: [{ element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } }, {}],
      });
      window.tour.drive();
    });

    await expect(instruction(page)).toBeVisible();
    await expect(indicator(page)).toBeVisible();
    await expect(page.locator(".driver-popover-footer")).toBeHidden();
    const pop = await box(popover(page));
    const row = await box(instruction(page));
    expect(pop.y + pop.height - (row.y + row.height)).toBeLessThan(20);
  });

  test("keep the dot on the first line of a long instruction", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          {
            element: "#one",
            popover: {
              title: "Act",
              instruction: "Click One, then wait for the list to load and pick the role you want from it.",
            },
          },
        ],
      });
      window.tour.drive();
    });

    const row = await box(instruction(page));
    const dot = await box(indicator(page));
    expect(row.height).toBeGreaterThan(50);
    expect(dot.y - row.y).toBeLessThan(20);
    expect(dot.x + dot.width).toBeLessThanOrEqual(row.x + row.width);
  });

  test("let other gestures through unless advanceOn is strict", async ({ page }) => {
    await page.evaluate(() => {
      document.addEventListener("contextmenu", event => event.preventDefault());
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [
          { element: "#one", advanceOn: "dblclick", popover: { title: "Loose", instruction: "Double-click." } },
          {
            element: "#two",
            advanceOn: { event: "dblclick", strict: true },
            popover: { title: "Strict", instruction: "Double-click." },
          },
          { element: "#intro", popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, "#one", ["contextmenu", "click"]);
    await record(page, "#two", ["contextmenu", "mousedown", "click", "dblclick"]);

    await page.locator("#one").click({ button: "right" });
    await settle(page);
    expect(await log(page)).toEqual(["contextmenu@#one"]);
    await expect(popover(page)).not.toHaveClass(/driver-popover-nudge/);

    await page.locator("#one").dblclick();
    await expect(title(page)).toHaveText("Strict");
    await settle(page);
    await page.evaluate(() => window.log.splice(0));

    await page.locator("#two").click({ button: "right" });
    await expect(popover(page)).toHaveClass(/driver-popover-nudge/);
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Strict");

    await page.locator("#two").dblclick();
    await expect(title(page)).toHaveText("After");
    expect(await log(page)).toEqual(["mousedown@#two", "click@#two", "mousedown@#two", "click@#two", "dblclick@#two"]);
  });

  test("show the done state for advanceDelay, then move on", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        advanceDelay: 3000,
        steps: [
          { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One." } },
          { element: "#two", advanceOn: "click", popover: { title: "Again", instruction: "Click Two." } },
        ],
      });
      window.tour.drive();
    });
    await expect(indicator(page)).toHaveCSS("border-radius", "50%");
    const waitingColor = await instruction(page).evaluate(element => getComputedStyle(element).backgroundColor);

    await page.locator("#one").click();
    await expect(popover(page)).toHaveClass(/driver-popover-instruction-done/);
    await expect(indicator(page)).toHaveCSS("animation-name", "none");
    await expect(indicator(page)).toHaveCSS("border-bottom-width", "2px");
    await expect(instruction(page)).toHaveCSS("color", "rgb(21, 128, 61)");
    await expect(nextButton(page)).toHaveCSS("color", "rgb(255, 255, 255)");
    await expect(nextButton(page)).toHaveCSS("background-color", "rgb(21, 128, 61)");
    await expect(nextButton(page)).toHaveCSS("opacity", "1");
    await expect(page.locator(".driver-live-region")).toHaveText("Done");
    const doneColor = await instruction(page).evaluate(element => getComputedStyle(element).backgroundColor);
    expect(doneColor).not.toBe(waitingColor);

    await nextButton(page).click({ force: true });
    await expect(popover(page)).not.toHaveClass(/driver-popover-nudge/);
    await expect(title(page)).toHaveText("Act");

    await expect(title(page)).toHaveText("Again", { timeout: 10000 });
    await expect(popover(page)).not.toHaveClass(/driver-popover-instruction-done/);
    await expect(nextButton(page)).toHaveText("Done");
    await expect(nextButton(page)).toHaveAttribute("aria-disabled", "true");

    await page.locator("#two").click();
    await expect(popover(page)).toHaveClass(/driver-popover-instruction-done/);
    await expect(popover(page)).toHaveCount(0, { timeout: 10000 });
  });

  test("respect reduced motion", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#one", popover: { title: "Act", instruction: "Click One." } }],
      });
      window.tour.drive();
    });

    await expect(indicator(page)).toHaveCSS("animation-name", "none");
  });
});

test.describe("instruction CSS", () => {
  const startWithCss = async (page: Page, css: string) => {
    await page.evaluate(css => {
      const style = document.createElement("style");
      style.textContent = css;
      document.head.appendChild(style);

      window.tour = window.driverjs.driver({
        animate: false,
        steps: [{ element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click it." } }],
      });
      window.tour.drive();
    }, css);
    await expect(title(page)).toHaveText("Act");
  };

  test("a plain rule hides the dot on an action step", async ({ page }) => {
    await startWithCss(page, ".driver-popover-instruction-indicator { display: none; }");

    await expect(instruction(page)).toBeVisible();
    await expect(indicator(page)).toBeHidden();
  });

  test("a row hidden by CSS stays hidden while the popover is nudged", async ({ page }) => {
    await startWithCss(page, ".driver-popover-instruction { display: none; }");
    await expect(instruction(page)).toBeHidden();

    const duringNudge = await page.evaluate(() => {
      window.tour.nudge();
      const popoverEl = document.querySelector(".driver-popover")!;
      const row = document.querySelector(".driver-popover-instruction")!;

      return { isNudged: popoverEl.classList.contains("driver-popover-nudge"), display: getComputedStyle(row).display };
    });
    expect(duringNudge).toEqual({ isNudged: true, display: "none" });
  });
});

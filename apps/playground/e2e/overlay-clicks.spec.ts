import { expect, test, type Page } from "@playwright/test";
import { box, clearLog, log, openFixture, overlay, popover, record, settle, title, topElementAt } from "./harness";

const NUDGED = /driver-popover-nudge/;

type Behavior = "close" | "nextStep" | "none" | "function";

async function startInstructionStep(page: Page, behavior: Behavior) {
  await page.evaluate(behavior => {
    window.tour?.destroy();
    window.tour = window.driverjs.driver({
      animate: false,
      stagePadding: 30,
      overlayClickBehavior: behavior === "function" ? () => window.log.push("overlay function") : behavior,
      onNextClick: () => window.log.push("onNextClick"),
      steps: [
        { element: "#one", advanceOn: "click", popover: { title: "Act", instruction: "Click One.", side: "bottom" } },
        { element: "#intro", popover: { title: "After" } },
      ],
    });
    window.tour.drive();
  }, behavior);
  await expect(overlay(page)).toHaveCount(1);
  await expect(title(page)).toHaveText("Act");
}

type StrictCase = { advanceOn?: unknown; isNeverMet?: boolean; hasInstruction: boolean; element?: string };

async function startGestureStep(page: Page, options: StrictCase) {
  await page.evaluate(options => {
    type AdvanceOn = NonNullable<NonNullable<Parameters<typeof window.driverjs.driver>[0]>["advanceOn"]>;
    let advanceOn = options.advanceOn as AdvanceOn | undefined;
    if (options.isNeverMet && typeof advanceOn === "object" && !Array.isArray(advanceOn)) {
      advanceOn = { ...advanceOn, when: () => false };
    }

    window.tour?.destroy();
    window.tour = window.driverjs.driver({
      animate: false,
      overlayClickBehavior: "none",
      steps: [
        {
          element: options.element ?? "#one",
          advanceOn,
          popover: { title: "Act", instruction: options.hasInstruction ? "Do it." : undefined },
        },
        { element: "#intro", popover: { title: "After" } },
      ],
    });
    window.tour.drive();
  }, options);
  await expect(overlay(page)).toHaveCount(1);
  await expect(title(page)).toHaveText("Act");
}

test.beforeEach(async ({ page }) => {
  await openFixture(page);
  await page.evaluate(() => document.addEventListener("contextmenu", event => event.preventDefault()));
});

test.describe("overlayClickBehavior", () => {
  test('"nextStep" moves on, or runs onNextClick, and onDoneClick on the last step', async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "nextStep",
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await page.mouse.click(5, 5);
    await expect(title(page)).toHaveText("Two");

    await page.evaluate(() => {
      window.tour.setConfig({
        ...window.tour.getConfig(),
        onNextClick: () => window.log.push("onNextClick"),
        onDoneClick: () => window.log.push("onDoneClick"),
      });
      window.tour.drive();
    });
    await expect(title(page)).toHaveText("One");
    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual(["onNextClick"]);
    await expect(title(page)).toHaveText("One");

    await page.evaluate(() => window.tour.moveTo(1));
    await expect(title(page)).toHaveText("Two");
    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual(["onNextClick", "onDoneClick"]);
    await expect(title(page)).toHaveText("Two");
  });

  test("a function gets the element, step and driver, and nothing else happens", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: (element, step, opts) => {
          window.log.push(`${(element as HTMLElement).id} ${step.popover?.title} ${opts.driver === window.tour}`);
        },
        steps: [
          { element: "#one", popover: { title: "One" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);

    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual(["one One true"]);
    await expect(title(page)).toHaveText("One");
  });
});

test.describe("overlay clicks on instruction steps", () => {
  test('nudge with "close" and "nextStep", do nothing with "none", and still call a function', async ({ page }) => {
    for (const behavior of ["close", "nextStep"] as const) {
      await startInstructionStep(page, behavior);
      await page.mouse.click(5, 5);
      await expect(popover(page)).toHaveClass(NUDGED);
      await expect(title(page)).toHaveText("Act");
      expect(await log(page)).toEqual([]);
    }

    await startInstructionStep(page, "none");
    await page.mouse.click(5, 5);
    await settle(page);
    await expect(popover(page)).not.toHaveClass(NUDGED);
    await expect(title(page)).toHaveText("Act");

    await startInstructionStep(page, "function");
    await page.mouse.click(5, 5);
    await settle(page);
    expect(await log(page)).toEqual(["overlay function"]);
    await expect(popover(page)).not.toHaveClass(NUDGED);
  });

  test("a click that falls through to the page nudges as well", async ({ page }) => {
    await startInstructionStep(page, "none");
    const one = await box(page.locator("#one"));
    await expect.poll(() => topElementAt(page, one.x + 5, one.y - 15)).toBe("body");

    await page.mouse.click(one.x + 5, one.y - 15);
    await expect(popover(page)).toHaveClass(NUDGED);
    await expect(title(page)).toHaveText("Act");
  });
});

test.describe("strict advanceOn", () => {
  test("a right-click step blocks clicks and double-clicks, then takes the right-click", async ({ page }) => {
    await startGestureStep(page, { advanceOn: { event: "contextmenu", strict: true }, hasInstruction: true });
    await record(page, null, ["pointerdown", "mousedown", "pointerup", "mouseup", "click", "dblclick", "contextmenu"]);

    await page.locator("#one").dblclick();
    await expect(popover(page)).toHaveClass(NUDGED);
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Act");

    await page.locator("#one").click({ button: "right" });
    await expect(title(page)).toHaveText("After");
    expect((await log(page)).slice(0, 3)).toEqual([
      "pointerdown@document",
      "mousedown@document",
      "contextmenu@document",
    ]);
  });

  test("a list takes each of its gestures and blocks the rest", async ({ page }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        advanceOn: { event: ["click", "contextmenu"], strict: true },
        steps: [
          {
            element: "#one",
            advanceOn: {
              event: ["click", "contextmenu"],
              strict: true,
              when: (_element, _step, opts) => opts.event.type === "contextmenu",
            },
            popover: { title: "One", instruction: "Right-click." },
          },
          { element: "#two", popover: { title: "Two", instruction: "Click." } },
          { element: "#intro", advanceOn: false, popover: { title: "After" } },
        ],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, null, ["click", "dblclick", "contextmenu"]);

    await page.locator("#one").dblclick();
    await settle(page);
    expect(await log(page)).toEqual(["click@document", "click@document"]);
    await expect(title(page)).toHaveText("One");

    await page.locator("#one").click({ button: "right" });
    await expect(title(page)).toHaveText("Two");
    expect(await log(page)).toContain("contextmenu@document");

    await page.locator("#two").click();
    await expect(title(page)).toHaveText("After");
  });

  test("works for the whole tour and without an instruction, leaves other elements alone and asks onInteraction first", async ({
    page,
  }) => {
    await page.evaluate(() => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: "none",
        advanceOn: { event: "dblclick", strict: true },
        onInteraction: (_element, _step, opts) => {
          window.log.push(`interaction ${opts.event.type} ${opts.region}`);

          return document.documentElement.dataset.block === "all" ? false : undefined;
        },
        steps: [{ element: "#one", allowedElements: "#side", popover: { title: "One" } }, {}],
      });
      window.tour.drive();
    });
    await expect(overlay(page)).toHaveCount(1);
    await record(page, null, ["mousedown", "contextmenu"]);

    await page.locator("#side-btn").click({ button: "right" });
    expect(await log(page)).toEqual(["mousedown@document", "interaction contextmenu allowed", "contextmenu@document"]);
    await expect(popover(page)).not.toHaveClass(NUDGED);

    await clearLog(page);
    await page.evaluate(() => {
      document.documentElement.dataset.block = "all";
    });
    await page.locator("#one").click({ button: "right" });
    await settle(page);
    expect(await log(page)).toEqual(["interaction contextmenu element"]);
    await expect(popover(page)).not.toHaveClass(NUDGED);

    await clearLog(page);
    await page.evaluate(() => {
      document.documentElement.dataset.block = "nothing";
    });
    await page.locator("#one").click({ button: "right" });
    await expect(popover(page)).toHaveClass(NUDGED);
    expect(await log(page)).toEqual(["interaction contextmenu element"]);
    await expect(title(page)).toHaveText("One");
  });

  const UNBLOCKED: Array<[string, StrictCase]> = [
    ['an instruction step waiting for "dblclick"', { advanceOn: "dblclick", hasInstruction: true }],
    ["an instruction step waiting for { event }", { advanceOn: { event: "dblclick" }, hasInstruction: true }],
    ["strict: false", { advanceOn: { event: "dblclick", strict: false }, hasInstruction: true }],
    ["an instruction step without advanceOn", { hasInstruction: true }],
    ['a plain step waiting for "dblclick"', { advanceOn: "dblclick", hasInstruction: false }],
    ['strict "input"', { advanceOn: { event: "input", strict: true }, hasInstruction: true, element: "#field" }],
    ['strict "mouseover"', { advanceOn: { event: "mouseover", strict: true }, isNeverMet: true, hasInstruction: true }],
    [
      'strict ["click", "input"]',
      { advanceOn: { event: ["click", "input"], strict: true }, isNeverMet: true, hasInstruction: true },
    ],
  ];

  test("blocks nothing unless it is strict and waits for click gestures only", async ({ page }) => {
    await record(page, null, ["mousedown", "click", "contextmenu"]);

    for (const [name, options] of UNBLOCKED) {
      await startGestureStep(page, options);
      await clearLog(page);
      const target = page.locator(options.element ?? "#one");
      await target.click();
      await target.click({ button: "right" });
      await settle(page);

      expect(await log(page), name).toEqual([
        "mousedown@document",
        "click@document",
        "mousedown@document",
        "contextmenu@document",
      ]);
      await expect(popover(page), name).not.toHaveClass(NUDGED);
      await expect(title(page), name).toHaveText("Act");
    }
  });
});

test.describe("overlay clicks on a plain tour", () => {
  const start = async (page: import("@playwright/test").Page, behavior: "close" | "none") => {
    await page.evaluate(behavior => {
      window.tour = window.driverjs.driver({
        animate: false,
        overlayClickBehavior: behavior,
        steps: [
          { element: "#intro", popover: { title: "Intro" } },
          { element: "#two", popover: { title: "Two" } },
        ],
      });
      window.tour.drive();
    }, behavior);
    await expect(overlay(page)).toHaveCount(1);
  };

  test("close by default", async ({ page }) => {
    await start(page, "close");
    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveCount(0);
  });

  test("none does nothing and never reaches a page listener on the body", async ({ page }) => {
    await start(page, "none");
    await record(page, null, ["pointerdown", "mousedown", "mouseup", "click"]);
    await page.mouse.click(5, 5);
    await page.locator("#outside").click({ force: true });
    await settle(page);
    expect(await log(page)).toEqual([]);
    await expect(title(page)).toHaveText("Intro");
  });
});

import { expect, test, type Page } from "@playwright/test";
import {
  activeIndex,
  box,
  closeButton,
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

type Traced = {
  onDestroyStarted?: "destroys" | "keeps";
  steps?: number;
  advanceOnClick?: boolean;
  destroyFrom?: "onNextClick" | "overlayClickBehavior";
  highlight?: "element" | "modal";
};

async function startTraced(page: Page, options: Traced = {}) {
  await page.evaluate(options => {
    window.log.splice(0);
    const hook =
      (name: string) =>
      (element: Element | undefined, step: { popover?: { title?: string } }, opts: { reason?: string }) => {
        const reason = opts.reason ? ` (${opts.reason})` : "";
        window.log.push(`${name}:${step.popover?.title}:${element ? element.id : "none"}${reason}`);
      };
    const destroy = () => window.tour.destroy();
    const steps = [
      { element: "#intro", popover: { title: "Intro" } },
      { element: "#two", popover: { title: "Two" } },
    ];

    const config: Parameters<typeof window.driverjs.driver>[0] = {
      animate: false,
      advanceOnClick: !!options.advanceOnClick,
      onDeselected: hook("onDeselected"),
      onDestroyed: hook("onDestroyed"),
      steps: steps.slice(0, options.steps ?? 2),
    };
    if (options.onDestroyStarted) {
      config.onDestroyStarted = (element, step, opts) => {
        hook("onDestroyStarted")(element, step, opts);
        if (options.onDestroyStarted === "destroys") {
          destroy();
        }
      };
    }
    if (options.destroyFrom) {
      config[options.destroyFrom] = destroy;
    }
    window.tour = window.driverjs.driver(config);

    if (options.highlight) {
      window.tour.highlight({
        element: options.highlight === "element" ? "#intro" : undefined,
        popover: { title: "Solo" },
      });
      return;
    }

    window.tour.drive();
  }, options);
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
}

const CLOSERS: Array<[string, (page: Page) => Promise<unknown>]> = [
  ["escape", page => page.keyboard.press("Escape")],
  ["overlay", page => page.mouse.click(5, 5)],
  ["close", page => closeButton(page).click()],
];

test.beforeEach(async ({ page }) => {
  await openFixture(page);
});

test.describe("hooks when the user closes a tour", () => {
  test("Escape, an overlay click and the close button run onDeselected then onDestroyed with their reason", async ({
    page,
  }) => {
    for (const [reason, act] of CLOSERS) {
      await startTraced(page);
      await act(page);

      await expect(popover(page)).toHaveCount(0);
      expect(await log(page), reason).toEqual([
        `onDeselected:Intro:intro (${reason})`,
        `onDestroyed:Intro:intro (${reason})`,
      ]);
      expect(await isActive(page)).toBe(false);
    }
  });

  test("onDestroyStarted runs first with the same reason, and decides whether the tour ends", async ({ page }) => {
    for (const [reason, act] of CLOSERS) {
      await startTraced(page, { onDestroyStarted: "destroys" });
      await act(page);

      await expect(popover(page)).toHaveCount(0);
      expect(await log(page), reason).toEqual([
        `onDestroyStarted:Intro:intro (${reason})`,
        `onDeselected:Intro:intro (${reason})`,
        `onDestroyed:Intro:intro (${reason})`,
      ]);
      expect(await isActive(page)).toBe(false);
    }

    for (const [reason, act] of CLOSERS) {
      await startTraced(page, { onDestroyStarted: "keeps" });
      await act(page);
      await settle(page);

      expect(await log(page), reason).toEqual([`onDestroyStarted:Intro:intro (${reason})`]);
      await expect(title(page)).toHaveText("Intro");
      expect(await isActive(page)).toBe(true);
      await page.evaluate(() => window.tour.destroy());
    }
  });
});

test.describe("destroy reason", () => {
  const done = ["onDeselected:Intro:intro (done)", "onDestroyed:Intro:intro (done)"];

  test('is "done" when the right arrow or the step\'s own click moves past the last step', async ({ page }) => {
    await startTraced(page, { steps: 1 });
    await page.keyboard.press("ArrowRight");
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(done);

    await startTraced(page, { steps: 1, advanceOnClick: true });
    await page.locator("#intro").click();
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(done);

    await startTraced(page, { steps: 1, destroyFrom: "onNextClick" });
    await page.keyboard.press("ArrowRight");
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(done);
  });

  test('is "overlay" when an overlayClickBehavior function ends the tour', async ({ page }) => {
    await startTraced(page, { destroyFrom: "overlayClickBehavior" });
    await page.mouse.click(5, 5);

    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(["onDeselected:Intro:intro (overlay)", "onDestroyed:Intro:intro (overlay)"]);
  });

  test("follows the way a single highlight was closed", async ({ page }) => {
    await startTraced(page, { highlight: "element" });
    await page.keyboard.press("Escape");
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(["onDeselected:Solo:intro (escape)", "onDestroyed:Solo:intro (escape)"]);

    await startTraced(page, { highlight: "element" });
    await page.mouse.click(5, 5);
    await expect(popover(page)).toHaveCount(0);
    expect(await log(page)).toEqual(["onDeselected:Solo:intro (overlay)", "onDestroyed:Solo:intro (overlay)"]);
  });

  test("of a cancelled Escape is forgotten by the next highlight, and a highlight without an element passes none", async ({
    page,
  }) => {
    await startTraced(page, { highlight: "modal", onDestroyStarted: "keeps" });
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await log(page)).toEqual(["onDestroyStarted:Solo:none (escape)"]);
    expect(await isActive(page)).toBe(true);

    await page.evaluate(() => {
      window.log.splice(0);
      window.tour.highlight({ element: "#two", popover: { title: "Another" } });
    });
    await expect(title(page)).toHaveText("Another");
    await settle(page);
    await page.evaluate(() => window.tour.destroy());

    expect(await log(page)).toEqual([
      "onDeselected:Solo:none",
      "onDeselected:Another:two (api)",
      "onDestroyed:Another:two (api)",
    ]);
  });
});

test("setSteps on a running tour stops it listening to clicks and keys", async ({ page }) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      onInteraction: (_element, _step, opts) => {
        window.log.push(`${opts.event.type} ${opts.region}`);
      },
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#two", popover: { title: "Two" } },
      ],
    });
    window.tour.drive();
  });
  await expect(overlay(page)).toHaveCount(1);
  await settle(page);
  await page.locator("#intro").click();
  expect(await log(page)).toContain("click element");

  await page.evaluate(() => {
    window.log.splice(0);
    window.tour.setSteps(window.tour.getConfig().steps!);
  });
  await page.locator("#intro").click();
  await page.keyboard.press("ArrowRight");
  await settle(page);

  expect(await log(page)).toEqual([]);
  expect(await isActive(page)).toBe(false);
  await expect(popover(page)).toHaveCount(0);
});

test("refresh() right before a step change does not place the new popover against the previous element", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.tour = window.driverjs.driver({
      animate: false,
      steps: [{ element: "#intro", popover: { title: "Intro" } }, { popover: { title: "Modal" } }],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("Intro");
  await settle(page);

  await page.evaluate(() => {
    window.tour.refresh();
    window.tour.moveNext();
  });
  await expect(title(page)).toHaveText("Modal");
  await settle(page);

  const viewport = page.viewportSize()!;
  const pop = await box(popover(page));
  expect(Math.abs(pop.x + pop.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(pop.y + pop.height / 2 - viewport.height / 2)).toBeLessThan(2);
});

test("an element replaced during an animated step change ends up highlighted, with the popover next to it", async ({
  page,
}) => {
  await page.evaluate(() => {
    document.querySelector("#slot")!.innerHTML = `<button id="temp" type="button">Temp</button>`;
    window.tour = window.driverjs.driver({
      duration: 150,
      onElementMissing: () => {
        window.log.push("missing");
      },
      onNextClick: element => {
        window.log.push(`next on ${element === document.querySelector("#temp") ? "the replacement" : "another node"}`);
      },
      steps: [
        { element: "#intro", popover: { title: "Intro" } },
        { element: "#temp", popover: { title: "Temp", side: "bottom" } },
      ],
    });
    window.tour.drive();
  });
  await expect(title(page)).toHaveText("Intro");
  await expect(popover(page)).toBeVisible();

  await page.evaluate(() => {
    window.tour.moveNext();
    requestAnimationFrame(() => {
      const original = document.querySelector("#temp")!;
      Object.assign(window, { original });
      document.querySelector("#slot")!.innerHTML =
        `<p style="margin-top:80px"><button id="temp" type="button">Temp again</button></p>`;
    });
  });
  await expect(title(page)).toHaveText("Temp");
  await expect(page.locator("#temp")).toHaveClass(/driver-active-element/);
  await expect(page.locator("#temp")).toHaveText("Temp again");

  const target = await box(page.locator("#temp"));
  await expect.poll(() => topElementAt(page, target.x + 4, target.y + 4)).toBe("temp");
  await expect
    .poll(async () => {
      const pop = await box(popover(page));
      return pop.y - (target.y + target.height);
    })
    .toBeGreaterThanOrEqual(0);
  const pop = await box(popover(page));
  expect(pop.y - (target.y + target.height)).toBeLessThan(40);
  expect(
    await page.evaluate(() => [
      window.tour.getActiveElement() === document.querySelector("#temp"),
      (window as unknown as { original: Element }).original.className,
    ])
  ).toEqual([true, ""]);

  await nextButton(page).click();
  expect(await log(page)).toEqual(["next on the replacement"]);
  expect(await activeIndex(page)).toBe(1);
});

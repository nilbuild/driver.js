import { describe, expect, it, vi } from "vitest";
import type { Config, DestroyReason, DriveStep } from "../../src/driver";
import { createDriver, navButton, nextFrame, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

const ONE_STEP: DriveStep[] = [{ element: "#intro", popover: { title: "Only" } }];

async function reasonAfter(config: Config, act: (d: ReturnType<typeof createDriver>) => void) {
  const onDestroyed = vi.fn();
  const d = createDriver({ animate: false, onDestroyed, ...config });
  d.drive();
  await nextFrame();

  act(d);

  return onDestroyed.mock.calls.at(-1)?.[2].reason as DestroyReason | undefined;
}

describe("destroy reason", () => {
  it.each<[DestroyReason, string, Config, (d: ReturnType<typeof createDriver>) => void]>([
    ["done", "moveNext() is called on the last step", { steps: ONE_STEP }, d => d.moveNext()],
    [
      "done",
      "the remaining steps are skipped as missing",
      { skipMissingElement: true, steps: [...ONE_STEP, { element: "#missing", popover: { title: "Gone" } }] },
      () => navButton("next")?.click(),
    ],
    ["api", "moveTo() is given an index outside the steps", { steps: SAMPLE_STEPS }, d => d.moveTo(10)],
  ])("is '%s' when %s", async (reason, _name, config, act) => {
    expect(await reasonAfter(config, act)).toBe(reason);
  });

  it.each<[DestroyReason, string, Config, () => void]>([
    [
      "close",
      "onCloseClick",
      { steps: SAMPLE_STEPS, onCloseClick: (_el, _step, { driver }) => driver.destroy() },
      () => navButton("close")?.click(),
    ],
    [
      "done",
      "onNextClick on the last step",
      { steps: ONE_STEP, onNextClick: (_el, _step, { driver }) => driver.destroy() },
      () => navButton("next")?.click(),
    ],
    [
      "done",
      "onDoneClick",
      { steps: ONE_STEP, onDoneClick: (_el, _step, { driver }) => driver.destroy() },
      () => navButton("next")?.click(),
    ],
    [
      "api",
      "onNextClick on a middle step",
      { steps: SAMPLE_STEPS, onNextClick: (_el, _step, { driver }) => driver.destroy() },
      () => navButton("next")?.click(),
    ],
  ])("is '%s' when %s calls destroy()", async (reason, _name, config, act) => {
    expect(await reasonAfter(config, act)).toBe(reason);
  });

  it("forgets a cancelled close once the tour moves on", async () => {
    const onDestroyStarted = vi.fn();

    const reason = await reasonAfter({ steps: SAMPLE_STEPS, onDestroyStarted }, d => {
      navButton("close")?.click();
      expect(d.isActive()).toBe(true);

      d.moveNext();
      d.destroy();
    });

    expect(reason).toBe("api");
  });

  it("is only passed to the hooks that run on destroy", async () => {
    const onHighlighted = vi.fn();
    const onNextClick = vi.fn((_el, _step, { driver }) => driver.moveNext());
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onHighlighted, onNextClick });
    d.drive();
    await nextFrame();

    navButton("next")?.click();
    await nextFrame();

    expect(onHighlighted.mock.calls[0][2]).not.toHaveProperty("reason");
    expect(onNextClick.mock.calls[0][2]).not.toHaveProperty("reason");
  });
});

describe("destroy reason for a single highlight", () => {
  const STEP = { element: "#intro", popover: { title: "Highlight" } };

  async function highlighted() {
    const onDestroyed = vi.fn();
    const d = createDriver({ animate: false, onDestroyed });
    d.highlight(STEP);
    await nextFrame();

    return { d, reason: () => onDestroyed.mock.calls.at(-1)?.[2].reason as DestroyReason | undefined };
  }

  it.each<[DestroyReason, string, (d: ReturnType<typeof createDriver>) => void]>([
    ["api", "destroy() is called directly", d => d.destroy()],
    ["replaced", "a tour starts on top of it", () => createDriver({ animate: false, steps: ONE_STEP }).drive()],
  ])("is '%s' when %s", async (expected, _name, act) => {
    const { d, reason } = await highlighted();

    act(d);

    expect(reason()).toBe(expected);
  });
});

import { describe, expect, it } from "vitest";
import type { Config, DriveStep, Popover } from "../../src/driver";
import { createDriver, navButton, nextFrame, popoverEl, pressKey, useDriverHarness } from "../utils";

useDriverHarness();

type Observed = {
  shown: string;
  disabled: string;
  footer: boolean;
  progress: string | false;
  next: string;
  previous: string;
  close: string | null;
  class: string;
};

const isShown = (element: HTMLElement | null) => !!element && element.style.display !== "none";

function observe(): Observed {
  const popover = popoverEl() as HTMLElement;
  const progress = popover.querySelector<HTMLElement>(".driver-popover-progress-text");
  const buttons = { next: navButton("next"), previous: navButton("prev"), close: navButton("close") };
  const names = Object.keys(buttons) as Array<keyof typeof buttons>;

  return {
    shown: names.filter(name => isShown(buttons[name])).join(","),
    disabled: names.filter(name => buttons[name]?.disabled).join(","),
    footer: isShown(popover.querySelector(".driver-popover-footer")),
    progress: isShown(progress) ? progress!.innerHTML : false,
    next: buttons.next!.innerHTML,
    previous: buttons.previous!.innerHTML,
    close: buttons.close!.getAttribute("aria-label"),
    class: popover.className,
  };
}

function renderTour(stepPopover: Popover, config: Config, index: number) {
  const step = (title: string, popover: Popover = {}): DriveStep => ({
    element: "#intro",
    popover: { title, ...popover },
  });
  const steps = [step("A"), step("B"), step("C")];
  steps[index] = step("target", stepPopover);

  const d = createDriver({ animate: false, steps, ...config });
  d.drive(index);

  return d;
}

const VALUE_OPTIONS: Array<[keyof Popover & keyof Config, unknown[], Array<keyof Observed>]> = [
  ["showButtons", [undefined, [], ["next"], ["close", "previous"]], ["shown", "footer"]],
  ["disableButtons", [undefined, [], ["next"], ["close"]], ["disabled"]],
  ["showProgress", [undefined, true, false], ["progress", "footer"]],
  ["progressText", [undefined, "", "S {{current}}/{{total}}"], ["progress"]],
  ["nextBtnText", [undefined, "", "Go"], ["next"]],
  ["prevBtnText", [undefined, "", "Back"], ["previous"]],
  ["doneBtnText", [undefined, "", "Finish"], ["next"]],
  ["closeBtnLabel", [undefined, "", "Dismiss"], ["close"]],
  ["popoverClass", [undefined, "", "mine"], ["class"]],
];

const pick = (observed: Observed, fields: Array<keyof Observed>) =>
  fields.map(field => `${field}: ${JSON.stringify(observed[field])}`).join(", ");

const label = (value: unknown) => (value === undefined ? "unset" : JSON.stringify(value));

function globalVariant(value: unknown): unknown {
  if (typeof value === "string" && value) {
    return `G-${value}`;
  }

  if (Array.isArray(value) && value.length) {
    return [...value].reverse().slice(0, 1);
  }

  return value;
}

describe("step vs config precedence", () => {
  for (const [option, values, fields] of VALUE_OPTIONS) {
    for (const index of [0, 1, 2]) {
      it(`${option} on step ${index + 1} of 3`, () => {
        const table: Record<string, string> = {};
        for (const stepValue of values) {
          for (const rawGlobal of values) {
            const globalValue = globalVariant(rawGlobal);
            const stepPopover = stepValue === undefined ? {} : { [option]: stepValue };
            const config: Config = {
              showProgress: option === "progressText" ? true : undefined,
              ...(globalValue === undefined ? {} : { [option]: globalValue }),
            };
            if (config.showProgress === undefined) {
              delete config.showProgress;
            }

            const d = renderTour(stepPopover, config, index);
            table[`step ${label(stepValue)} / config ${label(globalValue)}`] = pick(observe(), fields);
            d.destroy();
          }
        }

        expect(table).toMatchSnapshot();
      });
    }
  }

  it("allowClose: false drops the close button whatever showButtons says", () => {
    const table: Record<string, string> = {};
    for (const showButtons of [undefined, ["close"], ["next", "close"]] as Array<Popover["showButtons"]>) {
      const d = renderTour(showButtons ? { showButtons } : {}, { allowClose: false }, 1);
      table[`step ${label(showButtons)}`] = pick(observe(), ["shown", "footer"]);
      d.destroy();
    }

    expect(table).toMatchSnapshot();
  });
});

describe("hook precedence", () => {
  const HOOKS = ["onNextClick", "onPrevClick", "onCloseClick", "onDoneClick", "onPopoverRender"] as const;
  const SOURCES = ["none", "step", "config", "both"] as const;

  function act(hook: (typeof HOOKS)[number], via: string) {
    if (hook === "onPopoverRender") {
      return;
    }

    if (via === "key") {
      pressKey(hook === "onPrevClick" ? "ArrowLeft" : hook === "onCloseClick" ? "Escape" : "ArrowRight");
      return;
    }

    navButton(hook === "onPrevClick" ? "prev" : hook === "onCloseClick" ? "close" : "next")!.click();
  }

  for (const hook of HOOKS) {
    for (const via of hook === "onPopoverRender" ? ["render"] : ["button", "key"]) {
      it(`${hook} via ${via}`, async () => {
        const table: Record<string, string> = {};
        for (const index of [1, 2]) {
          for (const source of SOURCES) {
            const calls: string[] = [];
            const stepPopover: Popover =
              source === "step" || source === "both" ? { [hook]: () => calls.push("step") } : {};
            const config: Config =
              source === "config" || source === "both" ? { [hook]: () => calls.push("config") } : {};

            const d = renderTour(stepPopover, config, index);
            await nextFrame();
            act(hook, via);
            await nextFrame();
            const outcome = !d.isActive() ? "destroyed" : `index ${d.getActiveIndex()}`;
            table[`step ${index + 1} of 3, ${source}`] = `${calls.join("+") || "default"} -> ${outcome}`;
            d.destroy();
          }
        }

        expect(table).toMatchSnapshot();
      });
    }
  }

  it("a config onDoneClick wins over a step-level onNextClick on the last step", () => {
    const calls: string[] = [];
    const d = renderTour({ onNextClick: () => calls.push("step next") }, { onDoneClick: () => calls.push("done") }, 2);
    navButton("next")!.click();

    expect(calls).toEqual(["done"]);
    d.destroy();
  });
});

describe("highlight() precedence", () => {
  it("keeps its own defaults unless the popover overrides them", () => {
    const table: Record<string, string> = {};
    const variants: Array<[string, Popover, Config]> = [
      ["plain", {}, {}],
      ["config showProgress", {}, { showProgress: true }],
      ["config showButtons", {}, { showButtons: ["next", "close"] }],
      ["popover showButtons", { showButtons: ["next", "close"] }, {}],
      ["popover showProgress", { showProgress: true, progressText: "x" }, {}],
      ["config texts", {}, { nextBtnText: "Go", popoverClass: "mine", closeBtnLabel: "Dismiss" }],
    ];

    for (const [name, popover, config] of variants) {
      const d = createDriver({ animate: false, ...config });
      d.highlight({ element: "#intro", popover: { title: "Solo", ...popover } });
      table[name] = pick(observe(), ["shown", "footer", "progress", "next", "close", "class"]);
      d.destroy();
    }

    expect(table).toMatchSnapshot();
  });
});

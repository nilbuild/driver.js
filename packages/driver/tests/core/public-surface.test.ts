import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import * as checklistEntry from "../../src/checklist";
import * as driverEntry from "../../src/driver";
import * as hintsEntry from "../../src/hints";
import { createDriver, nextFrame, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

const root = `${process.cwd()}/`;
const read = (file: string) => readFileSync(root + file, "utf8");

const METHODS_1_10 = [
  "destroy",
  "drive",
  "getActiveElement",
  "getActiveIndex",
  "getActiveStep",
  "getConfig",
  "getNextStep",
  "getPreviousElement",
  "getPreviousStep",
  "getState",
  "hasNextStep",
  "hasPreviousStep",
  "highlight",
  "isActive",
  "isFirstStep",
  "isLastStep",
  "moveNext",
  "movePrevious",
  "moveTo",
  "refresh",
  "setConfig",
  "setSteps",
];

const METHODS_1_11 = ["nudge", "updatePopover"];

const DEFAULTS_1_10 = {
  animate: true,
  duration: 400,
  allowClose: true,
  allowScroll: true,
  overlayClickBehavior: "close",
  overlayOpacity: 0.7,
  smoothScroll: false,
  disableActiveInteraction: false,
  advanceOnClick: false,
  skipMissingElement: false,
  waitForElement: 0,
  showProgress: false,
  stagePadding: 10,
  stageRadius: 5,
  popoverOffset: 10,
  showButtons: ["next", "previous", "close"],
  disableButtons: [],
  overlayColor: "#000",
};

const STATE_KEYS_1_10 = [
  "isInitialized",
  "activeIndex",
  "activeElement",
  "activeStep",
  "previousElement",
  "previousStep",
  "popover",
  "__previousElement",
  "__activeElement",
  "__previousStep",
  "__activeStep",
  "__activeStagePosition",
  "__overlaySvg",
  "__events",
];

const CSS_1_10: Record<string, string[]> = {
  "src/styles/driver.css src/styles/popover.css": [
    ".driver-active",
    ".driver-active-element",
    ".driver-active-element-parent-no-scroll",
    ".driver-fade",
    ".driver-layer",
    ".driver-no-interaction",
    ".driver-no-scroll",
    ".driver-overlay",
    ".driver-popover",
    ".driver-popover-arrow",
    ".driver-popover-arrow-none",
    ".driver-popover-arrow-side-bottom",
    ".driver-popover-arrow-side-center",
    ".driver-popover-arrow-side-left",
    ".driver-popover-arrow-side-over",
    ".driver-popover-arrow-side-right",
    ".driver-popover-arrow-side-top",
    ".driver-popover-btn-disabled",
    ".driver-popover-close-btn",
    ".driver-popover-description",
    ".driver-popover-footer",
    ".driver-popover-footer-btn",
    ".driver-popover-navigation-btns",
    ".driver-popover-progress-text",
    ".driver-popover-title",
    "--driver-animation-duration",
    "--driver-popover-font-family",
    "@keyframes animate-fade-in",
  ],
  "src/styles/hints.css": [
    ".driver-hint",
    ".driver-hint-dot",
    ".driver-hint-hidden",
    ".driver-hint-no-animation",
    ".driver-hint-overlay",
    ".driver-hint-popover",
    ".driver-hint-pulse",
    "--driver-hint-animation-duration",
    "--driver-hint-color",
    "--driver-hint-size",
    "@keyframes driver-hint-overlay-fade",
    "@keyframes driver-hint-pulse",
  ],
  "src/styles/checklist.css": [
    ".driver-checklist",
    ".driver-checklist-bottom-left",
    ".driver-checklist-bottom-right",
    ".driver-checklist-check",
    ".driver-checklist-close-btn",
    ".driver-checklist-description",
    ".driver-checklist-header",
    ".driver-checklist-item",
    ".driver-checklist-item-description",
    ".driver-checklist-item-done",
    ".driver-checklist-item-title",
    ".driver-checklist-item-trigger",
    ".driver-checklist-items",
    ".driver-checklist-launcher",
    ".driver-checklist-launcher-count",
    ".driver-checklist-launcher-text",
    ".driver-checklist-no-launcher",
    ".driver-checklist-panel",
    ".driver-checklist-progress",
    ".driver-checklist-progress-bar",
    ".driver-checklist-progress-fill",
    ".driver-checklist-progress-text",
    ".driver-checklist-sr-only",
    ".driver-checklist-title",
    ".driver-checklist-top-left",
    ".driver-checklist-top-right",
    "--driver-checklist-color",
    "--driver-checklist-offset-x",
    "--driver-checklist-offset-y",
    "--driver-checklist-x",
    "--driver-checklist-y",
    "@keyframes driver-checklist-in",
    "@keyframes driver-checklist-in-down",
  ],
};

function outline(element: Element, depth = 0): string {
  const attributes = Array.from(element.attributes)
    .filter(attribute => !["id", "class", "style", "viewBox", "d"].includes(attribute.name))
    .map(attribute => `${attribute.name}=${attribute.value}`)
    .sort();
  const display = (element as HTMLElement).style?.display;
  if (display) {
    attributes.push(`display=${display}`);
  }

  const id = element.id ? `#${element.id}` : "";
  const classes = Array.from(element.classList)
    .filter(name => !name.startsWith("driver-popover-arrow-"))
    .map(name => `.${name}`)
    .join("");
  const text = element.children.length === 0 && element.textContent ? ` "${element.textContent}"` : "";
  const line = `${"  ".repeat(depth)}${element.tagName.toLowerCase()}${id}${classes}[${attributes.join(" ")}]${text}`;

  return [line, ...Array.from(element.children).map(child => outline(child, depth + 1))].join("\n");
}

describe("entry points", () => {
  it("export exactly what they always have", () => {
    expect(Object.keys(driverEntry)).toEqual(["driver"]);
    expect(Object.keys(hintsEntry)).toEqual(["hints"]);
    expect(Object.keys(checklistEntry)).toEqual(["checklist"]);
  });

  it("are published under the same file names", () => {
    const manifest = JSON.parse(read("package.json"));

    expect(manifest.main).toBe("./dist/driver.js.cjs");
    expect(manifest.module).toBe("./dist/driver.js.mjs");
    expect(manifest.types).toBe("./dist/driver.js.d.ts");
    expect(manifest.exports).toEqual({
      ".": {
        import: { types: "./dist/driver.js.d.mts", default: "./dist/driver.js.mjs" },
        require: { types: "./dist/driver.js.d.cts", default: "./dist/driver.js.cjs" },
      },
      "./hints": {
        import: { types: "./dist/hints.d.mts", default: "./dist/hints.mjs" },
        require: { types: "./dist/hints.d.cts", default: "./dist/hints.cjs" },
      },
      "./checklist": {
        import: { types: "./dist/checklist.d.mts", default: "./dist/checklist.mjs" },
        require: { types: "./dist/checklist.d.cts", default: "./dist/checklist.cjs" },
      },
      "./dist/driver.css": {
        import: "./dist/driver.css",
        require: "./dist/driver.css",
        default: "./dist/driver.css",
      },
      "./dist/hints.css": { import: "./dist/hints.css", require: "./dist/hints.css", default: "./dist/hints.css" },
      "./dist/checklist.css": {
        import: "./dist/checklist.css",
        require: "./dist/checklist.css",
        default: "./dist/checklist.css",
      },
    });

    for (const entry of ["hints", "checklist"]) {
      expect(JSON.parse(read(`${entry}/package.json`))).toMatchObject({
        main: `../dist/${entry}.cjs`,
        module: `../dist/${entry}.mjs`,
        types: `../dist/${entry}.d.ts`,
      });
    }
  });

  it("keep the documented CDN globals", () => {
    const config = read("tsdown.config.ts");

    expect(config).toContain('globalName: "driver.js"');
    expect(config).toContain('globalName: "driverHints"');
    expect(config).toContain('globalName: "driverChecklist"');
  });
});

describe("driver object", () => {
  it("has every method of 1.10 and 1.11", () => {
    const methods = Object.keys(createDriver());

    expect(methods).toEqual(expect.arrayContaining([...METHODS_1_10, ...METHODS_1_11]));
    for (const name of methods) {
      expect(typeof createDriver()[name as keyof ReturnType<typeof createDriver>]).toBe("function");
    }
  });

  it("starts from the 1.10 defaults, nothing more and nothing less", () => {
    expect(createDriver().getConfig()).toEqual(DEFAULTS_1_10);
  });

  it("returns what the methods always returned", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });

    expect(d.drive()).toBeUndefined();
    await nextFrame();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(0);
    expect(d.getActiveElement()).toBe(document.querySelector("#intro"));
    expect(d.getActiveStep()?.popover?.title).toBe("Step 1");
    expect(d.getNextStep()).toBe(SAMPLE_STEPS[1]);
    expect(d.getPreviousStep()).toBeUndefined();
    expect([d.hasNextStep(), d.hasPreviousStep(), d.isFirstStep(), d.isLastStep()]).toEqual([true, false, true, false]);
    expect(d.getConfig("animate" as never)).toBe(false);
    expect(d.getState("activeIndex")).toBe(0);
    expect(d.getState()).toBe(d.getState());
    expect(d.moveNext()).toBeUndefined();
    expect(d.movePrevious()).toBeUndefined();
    expect(d.moveTo(2)).toBeUndefined();
    expect(d.refresh()).toBeUndefined();
    expect(d.destroy()).toBeUndefined();
    expect(d.isActive()).toBe(false);
    expect(d.getState()).toEqual({});
  });

  it("keeps the 1.10 state keys on a running tour", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();

    const state = d.getState();
    for (const key of STATE_KEYS_1_10) {
      expect(state[key], key).toBeDefined();
    }
    expect(Object.keys(state.__events)).toEqual(
      expect.arrayContaining(["onKeyup", "onKeydown", "onResize", "onScroll"])
    );
  });

  it("passes hooks the element, the step and { config, state, driver, index }", async () => {
    const calls: string[] = [];
    const record =
      (name: string) =>
      (...args: unknown[]) => {
        const opts = args[2] as Record<string, unknown>;
        calls.push(`${name}(${args.length}) ${Object.keys(opts).sort().join(",")}`);
      };

    const d = createDriver({
      animate: false,
      steps: SAMPLE_STEPS,
      onHighlightStarted: record("onHighlightStarted"),
      onHighlighted: record("onHighlighted"),
      onDeselected: record("onDeselected"),
      onDestroyStarted: (...args) => {
        record("onDestroyStarted")(...args);
        d.destroy();
      },
      onDestroyed: record("onDestroyed"),
    });
    d.drive();
    await nextFrame();
    d.moveNext();
    await nextFrame();
    document.querySelector<HTMLElement>(".driver-popover-close-btn")!.click();

    expect(calls.map(call => call.replace(",signal", ""))).toEqual([
      "onHighlightStarted(3) config,driver,index,state",
      "onHighlighted(3) config,driver,index,state",
      "onDeselected(3) config,driver,index,state",
      "onHighlightStarted(3) config,driver,index,state",
      "onHighlighted(3) config,driver,index,state",
      "onDestroyStarted(3) config,driver,index,reason,state",
      "onDeselected(3) config,driver,index,reason,state",
      "onDestroyed(3) config,driver,index,reason,state",
    ]);
  });
});

describe("markup", () => {
  it("renders the popover the way themes and onPopoverRender code expect", async () => {
    const d = createDriver({ animate: false, showProgress: true, steps: SAMPLE_STEPS });
    d.drive(1);
    await nextFrame();

    expect(outline(document.querySelector(".driver-popover")!)).toBe(
      [
        "div#driver-popover-content.driver-popover.driver-popover-side-bottom.driver-popover-align-start[aria-describedby=driver-popover-description aria-labelledby=driver-popover-title role=dialog display=block]",
        '  button.driver-popover-close-btn[aria-label=Close type=button] "×"',
        "  div.driver-popover-arrow[]",
        '  div#driver-popover-title.driver-popover-title[] "Step 2"',
        '  div#driver-popover-description.driver-popover-description[] "Second"',
        "  div.driver-popover-footer[]",
        '    span.driver-popover-progress-text[] "2 of 3"',
        "    span.driver-popover-navigation-btns[]",
        '      button.driver-popover-prev-btn.driver-popover-footer-btn[type=button] "Previous"',
        '      button.driver-popover-next-btn.driver-popover-footer-btn[type=button] "Next"',
      ].join("\n")
    );

    const popover = d.getState("popover");
    expect(Object.keys(popover)).toEqual(
      expect.arrayContaining([
        "wrapper",
        "arrow",
        "title",
        "description",
        "footer",
        "previousButton",
        "nextButton",
        "closeButton",
        "footerButtons",
        "progress",
      ])
    );
  });

  it("marks the first and the last step on the buttons", async () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();
    await nextFrame();

    const previous = document.querySelector<HTMLButtonElement>(".driver-popover-prev-btn")!;
    expect(previous.disabled).toBe(true);
    expect(previous.classList.contains("driver-popover-btn-disabled")).toBe(true);

    d.drive(2);
    await nextFrame();

    const next = document.querySelector<HTMLButtonElement>(".driver-popover-next-btn")!;
    expect(next.textContent).toBe("Done");
    expect(next.classList.contains("driver-popover-done-btn")).toBe(true);
  });

  it("renders the overlay, the body classes and the element classes", async () => {
    const d = createDriver({ steps: SAMPLE_STEPS, duration: 1 });
    d.drive(1);
    await nextFrame();

    const overlay = document.querySelector(".driver-overlay")!;
    expect(outline(overlay)).toBe(
      ["svg.driver-overlay.driver-overlay-animated[preserveAspectRatio=xMinYMin slice version=1.1]", "  path[]"].join(
        "\n"
      )
    );
    expect(overlay.parentElement).toBe(document.body);
    expect((overlay as SVGElement).style.zIndex).toBe("10000");
    expect((overlay as SVGElement).style.position).toBe("fixed");
    expect(overlay.querySelector("path")!.style.pointerEvents).toBe("auto");

    expect(Array.from(document.body.classList)).toEqual(["driver-active", "driver-fade"]);
    expect(document.body.style.getPropertyValue("--driver-animation-duration")).toBe("1ms");

    const element = document.querySelector("#card-1")!;
    expect(element.classList.contains("driver-active-element")).toBe(true);
    expect(element.getAttribute("aria-haspopup")).toBe("dialog");
    expect(element.getAttribute("aria-expanded")).toBe("true");
    expect(element.getAttribute("aria-controls")).toBe("driver-popover-content");

    d.destroy();

    expect(document.body.className).toBe("");
    expect(document.body.getAttribute("style") || "").toBe("");
    expect(element.className).toBe("");
    expect(element.hasAttribute("aria-haspopup")).toBe(false);
    expect(document.querySelector("[class*=driver-]")).toBeNull();
    expect(document.getElementById("driver-dummy-element")).toBeNull();
  });

  it("highlights nothing with the dummy element in the middle of the page", async () => {
    const d = createDriver({ animate: false });
    d.highlight({ popover: { title: "Hello" } });
    await nextFrame();

    const dummy = document.getElementById("driver-dummy-element")!;
    expect(dummy.parentElement).toBe(document.body);
    expect(dummy.classList.contains("driver-active-element")).toBe(true);
    expect(document.querySelector<HTMLElement>(".driver-popover-footer")!.style.display).toBe("none");
  });
});

describe("stylesheets", () => {
  it("keep every class name, custom property and keyframe of 1.10", () => {
    for (const [files, names] of Object.entries(CSS_1_10)) {
      const css = files.split(" ").map(read).join("\n");
      const missing = names.filter(name => !new RegExp(`${name.replace(/[.]/g, "\\.")}(?![a-z0-9-])`).test(css));

      expect(missing, files).toEqual([]);
    }
  });

  it("keep the stacking order themes rely on", () => {
    const css = read("src/styles/popover.css");

    expect(css).toMatch(/\.driver-popover\s*\{[^}]*z-index:\s*1000000000/);
  });
});

describe("types", () => {
  it("still compile code written against 1.10 and 1.11", () => {
    const fixtures = ["usage-1.10.ts", "usage-1.11.ts"].map(name => `${root}tests/core/fixtures/${name}`);
    const program = ts.createProgram([...fixtures, `${root}src/css.d.ts`], {
      target: ts.ScriptTarget.ES2020,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      lib: ["lib.es2020.d.ts", "lib.dom.d.ts", "lib.dom.iterable.d.ts"],
      strict: true,
      noEmit: true,
      skipLibCheck: true,
      types: [],
      paths: {
        "driver.js": [`${root}src/driver.ts`],
        "driver.js/hints": [`${root}src/hints.ts`],
        "driver.js/checklist": [`${root}src/checklist.ts`],
      },
    });

    const errors = ts.getPreEmitDiagnostics(program).map(diagnostic => {
      const position = diagnostic.file?.getLineAndCharacterOfPosition(diagnostic.start || 0);
      const where = diagnostic.file ? `${diagnostic.file.fileName.replace(root, "")}:${(position?.line || 0) + 1}` : "";

      return `${where} ${ts.flattenDiagnosticMessageText(diagnostic.messageText, " ")}`;
    });

    expect(errors).toEqual([]);
  }, 60000);
});

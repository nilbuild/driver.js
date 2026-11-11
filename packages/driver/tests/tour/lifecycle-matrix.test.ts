import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type Config, type Driver, type DriveStep } from "../../src/driver";

const HTML = `
  <p id="intro">Intro</p>
  <button id="card-1" type="button">Card</button>
  <ul class="feature-list" id="list"><li>One</li></ul>
  <button id="other" type="button">Other</button>
`;

let trace: string[];
let instances: Driver[];

beforeEach(() => {
  vi.useFakeTimers({
    toFake: ["setTimeout", "clearTimeout", "requestAnimationFrame", "cancelAnimationFrame", "Date", "performance"],
  });
  document.body.innerHTML = HTML;
  trace = [];
  instances = [];
  isolatePage();
});

let detach: Array<() => void>;

function isolatePage() {
  detach = [];
  for (const target of [window, document]) {
    const add = target.addEventListener;
    target.addEventListener = function (this: EventTarget, type: string, listener: any, options?: any) {
      detach.push(() => target.removeEventListener(type, listener, options));
      return add.call(this, type, listener, options);
    } as typeof target.addEventListener;
    detach.push(() => {
      target.addEventListener = add;
    });
  }

  const observers = new Set<MutationObserver>();
  const Original = window.MutationObserver;
  class Tracked extends Original {
    constructor(callback: MutationCallback) {
      super(callback);
      observers.add(this);
    }
  }
  vi.stubGlobal("MutationObserver", Tracked);
  detach.push(() => {
    observers.forEach(observer => observer.disconnect());
    vi.unstubAllGlobals();
  });
}

afterEach(() => {
  instances.forEach(instance => instance.destroy());
  detach.reverse().forEach(undo => undo());
  document.body.innerHTML = "";
  document.body.className = "";
  document.body.removeAttribute("style");
  vi.useRealTimers();
});

const run = (ms: number) => vi.advanceTimersByTimeAsync(ms);
const settle = () => run(1200);
const frame = () => run(17);

const title = (step?: DriveStep) => step?.popover?.title ?? (step ? "untitled" : "none");
const idOf = (element?: Element | null) => (element ? element.id || element.tagName.toLowerCase() : "none");

function stateOf(d: Driver): string {
  const state = d.getState();
  const parts = [
    `i=${state.activeIndex ?? "-"}`,
    `step=${title(state.activeStep)}/${title(state.__activeStep)}`,
    `el=${idOf(state.activeElement)}/${idOf(state.__activeElement)}`,
    `prev=${title(state.previousStep)}/${title(state.__previousStep)}`,
    state.__transitionCallback ? "T" : "",
    state.__pendingWaitCancel ? "W" : "",
    state.isInitialized ? "" : "inactive",
  ];

  return parts.filter(Boolean).join(" ");
}

function marks(): string {
  const popovers = Array.from(document.querySelectorAll<HTMLElement>(".driver-popover"));
  const shown = popovers.filter(popover => popover.style.display !== "none");
  const popover = shown[0];
  const next = popover?.querySelector<HTMLButtonElement>(".driver-popover-next-btn");
  const previous = popover?.querySelector<HTMLButtonElement>(".driver-popover-prev-btn");
  const flags = ["waiting", "instruction-done", "has-instruction", "nudge"].filter(name =>
    popover?.classList.contains(`driver-popover-${name}`)
  );

  return [
    `popovers=${popovers.length}/${shown.length}`,
    `title=${popover?.querySelector(".driver-popover-title")?.textContent ?? "-"}`,
    `flags=${flags.join("+") || "-"}`,
    `next=${next ? `${next.textContent}${next.disabled ? ":disabled" : ""}${next.getAttribute("aria-disabled") ? ":gated" : ""}` : "-"}`,
    `prev=${previous?.disabled ? "disabled" : "on"}`,
    `busy=${popover?.getAttribute("aria-busy") ?? "-"}`,
    `overlays=${document.querySelectorAll(".driver-overlay").length}`,
    `active=${Array.from(document.querySelectorAll(".driver-active-element")).map(idOf).join(",") || "-"}`,
    `aria=${Array.from(document.querySelectorAll("[aria-haspopup=dialog]")).map(idOf).join(",") || "-"}`,
    `dummy=${document.getElementById("driver-dummy-element") ? "y" : "n"}`,
    `live=${document.querySelectorAll(".driver-live-region").length}`,
    `body=${document.body.className || "-"}`,
    `focus=${idOf(document.activeElement)}`,
  ].join(" ");
}

type Extra = Partial<Record<string, (d: Driver) => unknown>>;

const steps = (): DriveStep[] => [
  { element: "#intro", popover: { title: "S0" } },
  {
    element: "#card-1",
    advanceOn: {
      event: "click",
      when: () => {
        trace.push("when");
        return true;
      },
    },
    advanceDelay: 150,
    waitForElement: 100,
    popover: { title: "S1", instruction: "Click the card." },
  },
  { element: "#list", popover: { title: "S2" } },
  { element: "#late", waitForElement: 200, popover: { title: "S3" } },
  { popover: { title: "S4" } },
];

function create(config: Config = {}, inside: Extra = {}, name = "d"): Driver {
  const fired = new Set<string>();
  const once = (hook: string, d: Driver) => {
    if (!inside[hook] || fired.has(hook)) {
      return false;
    }

    fired.add(hook);
    trace.push(`  > inside ${hook}`);
    inside[hook]!(d);
    trace.push(`  < ${stateOf(d)}`);

    return true;
  };

  const log =
    (hook: string) =>
    (element: Element | undefined, step: DriveStep, opts: { reason?: string; cause?: string; index?: number }) => {
      const extra = [opts.reason && `reason=${opts.reason}`, opts.cause && `cause=${opts.cause}`].filter(Boolean);
      trace.push(
        `${name}.${hook} ${title(step)} el=${idOf(element)} index=${opts.index ?? "-"} ${extra.join(" ")}| ${stateOf(d)}`
      );
      once(hook, d);
    };

  const clickHook = (hook: string, fallback: (d: Driver) => void) =>
    inside[hook]
      ? (element: Element | undefined, step: DriveStep, opts: { index?: number }) => {
          trace.push(`${name}.${hook} ${title(step)} el=${idOf(element)} index=${opts.index ?? "-"} | ${stateOf(d)}`);
          if (!once(hook, d)) {
            fallback(d);
          }
        }
      : undefined;

  const d: Driver = driver({
    animate: false,
    steps: steps(),
    onHighlightStarted: log("onHighlightStarted"),
    onHighlighted: log("onHighlighted"),
    onDeselected: log("onDeselected"),
    onDestroyed: log("onDestroyed"),
    onElementMissing: (element, step, opts) => {
      log("onElementMissing")(element, step, opts);
    },
    onPopoverRender: (popover, opts) => {
      trace.push(`${name}.onPopoverRender ${popover.title.textContent} index=${opts.index ?? "-"} | ${stateOf(d)}`);
      once("onPopoverRender", d);
    },
    onInteraction: (element, step, opts) => {
      trace.push(`${name}.onInteraction ${title(step)} ${opts.event.type} ${opts.region}`);
      once("onInteraction", d);
    },
    onDestroyStarted: inside.onDestroyStarted
      ? (element, step, opts) => {
          log("onDestroyStarted")(element, step, opts);
          if (d.isActive() && !inside.keepAfterDestroyStarted) {
            d.destroy();
          }
        }
      : undefined,
    onNextClick: clickHook("onNextClick", instance => instance.moveNext()),
    onPrevClick: clickHook("onPrevClick", instance => instance.movePrevious()),
    onCloseClick: clickHook("onCloseClick", instance => instance.destroy()),
    ...config,
  });
  instances.push(d);

  return d;
}

const $ = (selector: string) => document.querySelector<HTMLElement>(selector);
const click = (selector: string, init: MouseEventInit = {}) =>
  $(selector)?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, ...init }));
const key = (name: string) => window.dispatchEvent(new KeyboardEvent("keyup", { key: name }));

function rerender(selector: string, id: string) {
  const existing = $(selector);
  const copy = document.createElement("button");
  copy.id = id;
  copy.className = existing?.className.replace(/driver-\S+/g, "").trim() ?? "";
  if (existing) {
    existing.replaceWith(copy);
  } else {
    document.body.appendChild(copy);
  }
}

type Stage = { name: string; element: string; id: string; config?: Config; enter: (d: Driver) => Promise<void> };

const STATES: Stage[] = [
  {
    name: "waiting for the first element",
    element: "#late",
    id: "late",
    enter: async d => {
      d.drive(3);
      await frame();
    },
  },
  {
    name: "moving to a step",
    element: "#card-1",
    id: "card-1",
    config: { animate: true, duration: 200 },
    enter: async d => {
      d.drive(0);
      await settle();
      d.moveTo(1);
      await frame();
    },
  },
  {
    name: "active",
    element: "#card-1",
    id: "card-1",
    enter: async d => {
      d.drive(1);
      await settle();
    },
  },
  {
    name: "waiting for the next element",
    element: "#list",
    id: "list",
    enter: async d => {
      d.drive(2);
      await settle();
      d.moveNext();
      await frame();
    },
  },
  {
    name: "done pause",
    element: "#card-1",
    id: "card-1",
    enter: async d => {
      d.drive(1);
      await settle();
      click("#card-1");
      await run(20);
    },
  },
  {
    name: "element missing, in its grace period",
    element: "#card-1",
    id: "card-1",
    enter: async d => {
      d.drive(1);
      await settle();
      $("#card-1")!.remove();
      await run(40);
    },
  },
];

const ACTIONS: Record<string, (d: Driver, stage: Stage) => unknown> = {
  "moveNext()": d => d.moveNext(),
  "movePrevious()": d => d.movePrevious(),
  "moveTo(2)": d => d.moveTo(2),
  "moveTo(3), whose element is missing": d => d.moveTo(3),
  "drive(0)": d => d.drive(0),
  "destroy()": d => d.destroy(),
  "setSteps()": d => d.setSteps([{ element: "#other", popover: { title: "New" } }]),
  "setSteps() then drive()": d => {
    d.setSteps([{ element: "#other", popover: { title: "New" } }]);
    d.drive();
  },
  "refresh()": d => d.refresh(),
  "highlight()": d => d.highlight({ element: "#other", popover: { title: "Solo" } }),
  "advance()": d => d.advance(),
  "advance() twice": d => {
    d.advance();
    d.advance();
  },
  "updatePopover()": d => d.updatePopover({ title: "Patched" }),
  "nudge(message)": d => d.nudge("Look"),
  "a click on the element": (_d, stage) => click(stage.element),
  "a double click on the element": (_d, stage) => {
    click(stage.element, { detail: 1 });
    click(stage.element, { detail: 2 });
  },
  "the element is removed": (_d, stage) => $(stage.element)?.remove(),
  "the element is re-rendered": (_d, stage) => rerender(stage.element, stage.id),
  "the next step's element shows up": () => rerender("#late", "late"),
  "a resize": () => window.dispatchEvent(new Event("resize")),
  "a scroll": () => window.dispatchEvent(new Event("scroll")),
  Escape: () => key("Escape"),
  ArrowRight: () => key("ArrowRight"),
  ArrowLeft: () => key("ArrowLeft"),
  "a click on Next": () => $(".driver-popover-next-btn")?.click(),
  "a click on Previous": () => $(".driver-popover-prev-btn")?.click(),
  "a click on Close": () => $(".driver-popover-close-btn")?.click(),
  "a click on the overlay": () =>
    $(".driver-overlay path")?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true })),
  "another instance starts": () => {
    const other = create({ steps: [{ element: "#other", popover: { title: "Other" } }] }, {}, "other");
    other.drive();
  },
};

describe.each(STATES)("while $name", stage => {
  it.each(Object.keys(ACTIONS))("%s", async action => {
    const d = create(stage.config);
    await stage.enter(d);
    trace.push(`== ${stage.name}: ${stateOf(d)}`, `   ${marks()}`, `== ${action}`);

    ACTIONS[action](d, stage);
    trace.push(`-- right after: ${stateOf(d)}`, `   ${marks()}`);
    await frame();
    trace.push(`-- a frame later: ${stateOf(d)}`, `   ${marks()}`);
    await run(60);
    trace.push(`-- 60ms later: ${stateOf(d)}`, `   ${marks()}`);
    await settle();
    trace.push(`-- settled: ${stateOf(d)}`, `   ${marks()}`);

    instances.forEach(instance => instance.destroy());
    await frame();
    trace.push(`-- destroyed: ${stateOf(d)}`, `   ${marks()}`);

    expect(trace).toMatchSnapshot();
  });
});

const CALLS: Record<string, (d: Driver) => unknown> = {
  "moveNext()": d => d.moveNext(),
  "movePrevious()": d => d.movePrevious(),
  "moveTo(2)": d => d.moveTo(2),
  "moveTo(3)": d => d.moveTo(3),
  "drive(0)": d => d.drive(0),
  "destroy()": d => d.destroy(),
  "setSteps()": d => d.setSteps([{ element: "#other", popover: { title: "New" } }]),
  "highlight()": d => d.highlight({ element: "#other", popover: { title: "Solo" } }),
  "refresh()": d => d.refresh(),
  "advance()": d => d.advance(),
  "updatePopover()": d => d.updatePopover({ description: "Patched" }),
};

const HOOKS = [
  "onHighlightStarted",
  "onHighlighted",
  "onDeselected",
  "onDestroyStarted",
  "onDestroyed",
  "onNextClick",
  "onPrevClick",
  "onCloseClick",
  "onPopoverRender",
  "onElementMissing",
  "onInteraction",
];

async function walk(d: Driver) {
  const say = (what: string) => trace.push(`== ${what}: ${stateOf(d)}`, `   ${marks()}`);

  d.drive(0);
  await settle();
  say("started");
  $(".driver-popover-next-btn")?.click();
  await settle();
  say("after Next");
  click("#card-1");
  await run(60);
  say("after the action, pausing");
  await settle();
  say("after the pause");
  $(".driver-popover-prev-btn")?.click();
  await settle();
  say("after Previous");
  $("#card-1")?.remove();
  await settle();
  say("after the element was removed");
  key("Escape");
  await settle();
  say("after Escape");
  $(".driver-popover-close-btn")?.click();
  await settle();
  say("after Close");
  d.destroy();
  await frame();
  say("after destroy()");
}

describe.each(HOOKS)("from inside %s", hook => {
  it.each(Object.keys(CALLS))("%s", async call => {
    const d = create({}, { [hook]: CALLS[call] });
    await walk(d);

    expect(trace).toMatchSnapshot();
  });
});

describe("from inside advanceOn's when()", () => {
  it.each(Object.keys(CALLS))("%s", async call => {
    let hasFired = false;
    const d = create();
    const withWhen = steps();
    withWhen[1].advanceOn = {
      event: "click",
      when: () => {
        trace.push(`when | ${stateOf(d)}`);
        if (!hasFired) {
          hasFired = true;
          CALLS[call](d);
          trace.push(`  < ${stateOf(d)}`);
        }

        return true;
      },
    };
    d.setSteps(withWhen);
    await walk(d);

    expect(trace).toMatchSnapshot();
  });
});

describe("sequences", () => {
  const record = async (d: Driver, what: string) => {
    trace.push(`== ${what}: ${stateOf(d)}`, `   ${marks()}`);
  };

  it.each([
    ["next next next", ["moveNext", "moveNext", "moveNext"]],
    ["next previous next", ["moveNext", "movePrevious", "moveNext"]],
    ["previous previous", ["movePrevious", "movePrevious"]],
    ["next previous previous next", ["moveNext", "movePrevious", "movePrevious", "moveNext"]],
  ] as const)("rapid %s, animated and not", async (_name, calls) => {
    for (const animate of [true, false]) {
      for (const gap of [0, 17, 120]) {
        const d = create({ animate, duration: 200 });
        d.drive(1);
        await settle();
        trace.push(`## animate=${animate} gap=${gap}`);
        for (const call of calls) {
          d[call]();
          await record(d, call);
          await run(gap);
        }
        await settle();
        await record(d, "settled");
        d.destroy();
        await frame();
      }
    }

    expect(trace).toMatchSnapshot();
  });

  it("destroy from the hook of a wait that timed out", async () => {
    for (const result of ["destroy", "false", "moveTo", "nothing"]) {
      const d = create({
        onElementMissing: (_element, step, opts) => {
          trace.push(`onElementMissing ${title(step)} cause=${opts.cause} index=${opts.index} | ${stateOf(d)}`);
          if (result === "destroy") {
            d.destroy();
          }
          if (result === "moveTo") {
            d.moveTo(0);
          }

          return result === "false" ? false : undefined;
        },
      });
      trace.push(`## hook answers with ${result}`);
      d.drive(2);
      await settle();
      d.moveNext();
      await record(d, "waiting");
      await settle();
      await record(d, "after the timeout");
      d.destroy();
      await frame();

      trace.push(`## the same on the first step`);
      d.drive(3);
      await frame();
      await record(d, "waiting");
      await settle();
      await record(d, "after the timeout");
      d.destroy();
      await frame();
    }

    expect(trace).toMatchSnapshot();
  });

  it("presets when the element goes missing or the wait runs out", async () => {
    for (const onElementMissing of ["stay", "previous", "previousAction"] as const) {
      const d = create({ onElementMissing });
      trace.push(`## ${onElementMissing}: removed`);
      d.drive(1);
      await settle();
      $("#card-1")!.remove();
      await run(40);
      await record(d, "in grace");
      await settle();
      await record(d, "after grace");
      d.destroy();
      await frame();
      rerender("#card-1", "card-1");

      trace.push(`## ${onElementMissing}: timeout`);
      d.drive(2);
      await settle();
      d.moveNext();
      await settle();
      await record(d, "after the timeout");
      d.destroy();
      await frame();
    }

    expect(trace).toMatchSnapshot();
  });

  it("two instances hand over at every moment", async () => {
    for (const stage of STATES) {
      const first = create(stage.config, {}, "first");
      await stage.enter(first);
      const second = create({ animate: true, duration: 200 }, {}, "second");
      trace.push(`## while ${stage.name}`);
      second.drive(0);
      await record(first, "first, right after");
      await record(second, "second, right after");
      await run(50);
      first.drive(2);
      await record(first, "first took it back mid-transition");
      await settle();
      await record(first, "settled");
      await record(second, "second");
      first.destroy();
      second.destroy();
      await frame();
      document.body.innerHTML = HTML;
    }

    expect(trace).toMatchSnapshot();
  });

  it("an action that completes while the next step is still on its way", async () => {
    const d = create({ animate: true, duration: 200 });
    d.drive(0);
    await settle();
    d.moveNext();
    await run(50);
    click("#card-1");
    await record(d, "clicked mid-transition");
    await run(100);
    await record(d, "during the pause");
    d.advance();
    click("#card-1");
    await settle();
    await record(d, "settled");

    expect(trace).toMatchSnapshot();
  });

  it("the element leaves and comes back in every order around a completion", async () => {
    for (const order of ["remove-click", "click-remove", "remove-wait-back", "click-remove-back"]) {
      const d = create();
      trace.push(`## ${order}`);
      d.drive(1);
      await settle();
      const card = $("#card-1")!;
      if (order === "remove-click") {
        card.remove();
        card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
      }
      if (order.startsWith("click-remove")) {
        click("#card-1");
        card.remove();
      }
      if (order === "remove-wait-back") {
        card.remove();
        await run(50);
        await record(d, "gone");
        document.body.appendChild(card);
      }
      await run(50);
      await record(d, "50ms on");
      if (order === "click-remove-back") {
        document.body.appendChild(card);
      }
      await settle();
      await record(d, "settled");
      d.destroy();
      await frame();
      document.body.innerHTML = HTML;
    }

    expect(trace).toMatchSnapshot();
  });
});

describe("on a driver that is not running", () => {
  const pageIsClean = () =>
    document.querySelector("[class*=driver-]") === null &&
    document.body.className === "" &&
    document.querySelector("[aria-haspopup=dialog]") === null;

  it("moveTo() starts the tour like drive() does, and destroy() cleans it all up", async () => {
    const d = create();

    d.moveTo(1);
    await settle();

    expect(d.isActive()).toBe(true);
    expect(d.getActiveIndex()).toBe(1);
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(document.querySelectorAll(".driver-overlay")).toHaveLength(1);
    expect(document.querySelectorAll(".driver-live-region")).toHaveLength(1);
    expect(marks()).toContain("title=S1");

    key("ArrowLeft");
    await settle();
    expect(d.getActiveIndex()).toBe(0);

    d.destroy();
    expect(d.isActive()).toBe(false);
    expect(pageIsClean()).toBe(true);
  });

  it("moveTo() starts it again after destroy()", async () => {
    const d = create();
    d.drive(0);
    await settle();
    d.destroy();

    d.moveTo(2);
    await settle();
    expect(d.isActive()).toBe(true);
    expect(marks()).toContain("title=S2");

    d.destroy();
    expect(pageIsClean()).toBe(true);
  });

  it("moveTo() with an index that has no step does nothing, and leaves another tour alone", async () => {
    const other = create({}, {}, "other");
    other.drive(0);
    await settle();
    const d = create();
    trace.length = 0;

    d.moveTo(99);
    await settle();

    expect(d.isActive()).toBe(false);
    expect(other.isActive()).toBe(true);
    expect(trace).toEqual([]);
  });

  it.each([
    ["moveNext()", (d: Driver) => d.moveNext()],
    ["movePrevious()", (d: Driver) => d.movePrevious()],
    ["refresh()", (d: Driver) => d.refresh()],
    ["advance()", (d: Driver) => d.advance()],
    ["nudge()", (d: Driver) => d.nudge()],
    ["nudge(message)", (d: Driver) => d.nudge("Look")],
    ["nudge(patch)", (d: Driver) => d.nudge({ title: "Patched" })],
    ["updatePopover()", (d: Driver) => d.updatePopover({ title: "Patched" })],
    ["destroy()", (d: Driver) => d.destroy()],
  ] as const)("%s does nothing, before a tour and after one", async (_name, call) => {
    const d = create();

    call(d);
    await settle();
    expect(d.isActive()).toBe(false);
    expect(pageIsClean()).toBe(true);
    expect(trace).toEqual([]);

    d.drive(0);
    await settle();
    d.destroy();
    trace.length = 0;

    call(d);
    await settle();
    expect(d.isActive()).toBe(false);
    expect(pageIsClean()).toBe(true);
    expect(trace).toEqual([]);
  });

  it("highlight() works after destroy()", async () => {
    const d = create();
    d.drive(0);
    await settle();
    d.destroy();

    d.highlight({ element: "#other", popover: { title: "Solo" } });
    await settle();
    expect(d.isActive()).toBe(true);
    expect(document.body.classList.contains("driver-active")).toBe(true);
    expect(marks()).toContain("title=Solo");

    d.destroy();
    expect(pageIsClean()).toBe(true);
  });
});

import {
  driver,
  type AdvanceOn,
  type AdvanceOnEvent,
  type AdvanceOnOpts,
  type AllowedElements,
  type Config,
  type DriveStep,
  type Driver,
  type ElementMissingHook,
  type ElementMissingOpts,
  type HookOpts,
  type InteractionHook,
  type InteractionOpts,
  type InteractionRegion,
  type PopoverPatch,
} from "driver.js";

const advanceShapes: AdvanceOn[] = [
  false,
  "click",
  "contextmenu",
  ["dblclick", "keydown"],
  { event: "input" },
  { event: ["input", "change"], when: (element, step, opts) => !!element && !!step && opts.event.type === "input" },
];

const advanceEvent: AdvanceOnEvent = {
  event: "input",
  when: (element: Element, step: DriveStep, opts: AdvanceOnOpts) => {
    const base: HookOpts = opts;
    const event: Event = opts.event;
    void [base, event, step];

    return (element as HTMLInputElement).value === "ok";
  },
};

const allowed: AllowedElements[] = [
  "#menu",
  document.body,
  ["#menu", document.body],
  () => document.querySelectorAll(".menu"),
  () => [document.body],
  () => null,
  () => undefined,
];

const onInteraction: InteractionHook = (element, step, opts) => {
  const options: InteractionOpts = opts;
  const region: InteractionRegion = opts.region;
  const event: MouseEvent = opts.event;
  const regions: InteractionRegion[] = ["element", "allowed", "outside"];
  void [element, step, options, event, regions];
  if (region === "outside") {
    return false;
  }

  return undefined;
};

const onElementMissing: ElementMissingHook = (element, step, opts) => {
  const options: ElementMissingOpts = opts;
  const cause: "removed" | "timeout" = opts.cause;
  void [element, step, options];
  if (cause === "timeout") {
    return false;
  }

  opts.driver.movePrevious();
};

const steps: DriveStep[] = [
  {
    element: "#a",
    advanceOn: advanceEvent,
    advanceOnClick: true,
    onInteraction,
    allowedElements: "#menu",
    onElementMissing,
    skipMissingElement: false,
    waitForElement: 500,
    onHighlighted: (element, step, opts) => {
      const signal: AbortSignal | undefined = opts.signal;
      signal?.addEventListener("abort", () => undefined);
      void [element, step];
    },
  },
];

const config: Config = {
  steps,
  advanceOn: "click",
  advanceOnClick: false,
  onInteraction,
  allowedElements: allowed[2],
  onElementMissing,
  showButtons: [],
};

const patch: PopoverPatch = {
  title: "Title",
  description: "Description",
  showButtons: ["next"],
  disableButtons: ["next"],
  showProgress: true,
  progressText: "{{current}}",
  nextBtnText: "Next",
  prevBtnText: "Previous",
  closeBtnLabel: "Close",
  popoverClass: "theme",
};

const driverObj: Driver = driver(config);
driverObj.updatePopover(patch);
driverObj.updatePopover();
driverObj.nudge();
driverObj.nudge({ description: "Try the other button" });
driverObj.nudge(patch);

export { advanceShapes };

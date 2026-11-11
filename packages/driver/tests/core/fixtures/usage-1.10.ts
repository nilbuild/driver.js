import {
  driver,
  type Alignment,
  type AllowedButtons,
  type Config,
  type DestroyReason,
  type DriveStep,
  type Driver,
  type DriverHook,
  type HookOpts,
  type Popover,
  type PopoverDOM,
  type Side,
  type StageDefinition,
  type State,
} from "driver.js";
import {
  hints,
  type DriverHint,
  type HintBeacon,
  type HintHook,
  type HintPopover,
  type Hints,
  type HintsConfig,
  type Alignment as HintAlignment,
  type PopoverDOM as HintPopoverDOM,
  type Side as HintSide,
} from "driver.js/hints";
import {
  checklist,
  type Checklist,
  type ChecklistConfig,
  type ChecklistEvent,
  type ChecklistEventType,
  type ChecklistItem,
  type ChecklistItemHook,
  type ChecklistPosition,
  type ChecklistProgress,
  type DestroyReason as ChecklistDestroyReason,
} from "driver.js/checklist";

const side: Side = "top";
const align: Alignment = "center";
const buttons: AllowedButtons[] = ["next", "previous", "close"];
const reasons: DestroyReason[] = ["done", "close", "escape", "overlay", "replaced", "api"];
const stage: StageDefinition = { x: 0, y: 0, width: 10, height: 10 };

const hook: DriverHook = (element, step, opts) => {
  const el: Element | undefined = element;
  const title: string | undefined = step.popover?.title;
  const options: HookOpts = opts;
  const config: Config = opts.config;
  const state: State = opts.state;
  const instance: Driver = opts.driver;
  const index: number | undefined = opts.index;
  const reason: DestroyReason | undefined = opts.reason;
  void [el, title, options, config, state, instance, index, reason];
};

const onPopoverRender = (popover: PopoverDOM, opts: HookOpts) => {
  const parts: HTMLElement[] = [
    popover.wrapper,
    popover.arrow,
    popover.title,
    popover.description,
    popover.footer,
    popover.progress,
    popover.footerButtons,
  ];
  const controls: HTMLButtonElement[] = [popover.previousButton, popover.nextButton, popover.closeButton];
  const first = document.createElement("button");
  popover.footerButtons.appendChild(first);
  first.addEventListener("click", () => opts.driver.drive(0));
  void [parts, controls];
};

const popover: Popover = {
  title: "Title",
  description: "Description",
  side,
  align,
  showButtons: buttons,
  showProgress: true,
  disableButtons: ["previous"],
  popoverClass: "theme",
  progressText: "{{current}} of {{total}}",
  doneBtnText: "Done",
  nextBtnText: "Next",
  prevBtnText: "Previous",
  closeBtnLabel: "Close",
  onPopoverRender,
  onNextClick: hook,
  onPrevClick: hook,
  onCloseClick: hook,
  onDoneClick: hook,
};

const steps: DriveStep[] = [
  { element: "#selector", popover },
  { element: document.body, popover: { title: "Element" } },
  { element: () => document.body, popover: { title: "Function" } },
  { popover: { title: "No element" } },
  {
    element: ".all",
    onHighlightStarted: hook,
    onHighlighted: hook,
    onDeselected: hook,
    disableActiveInteraction: true,
    advanceOnClick: true,
    skipMissingElement: true,
    waitForElement: 1000,
    data: { anything: 1, nested: { ok: true } },
  },
];

const config: Config = {
  steps,
  animate: true,
  duration: 400,
  overlayColor: "#000",
  overlayOpacity: 0.7,
  smoothScroll: false,
  allowClose: true,
  allowScroll: true,
  overlayClickBehavior: "close",
  stagePadding: 10,
  stageRadius: 5,
  disableActiveInteraction: false,
  advanceOnClick: false,
  skipMissingElement: false,
  waitForElement: 0,
  allowKeyboardControl: true,
  popoverClass: "theme",
  popoverOffset: 10,
  showButtons: buttons,
  disableButtons: [],
  showProgress: false,
  progressText: "{{current}} of {{total}}",
  nextBtnText: "Next",
  prevBtnText: "Previous",
  doneBtnText: "Done",
  closeBtnLabel: "Close",
  onPopoverRender,
  onHighlightStarted: hook,
  onHighlighted: hook,
  onDeselected: hook,
  onDestroyStarted: hook,
  onDestroyed: hook,
  onNextClick: hook,
  onPrevClick: hook,
  onCloseClick: hook,
  onDoneClick: hook,
};

const overlayBehaviors: Config[] = [
  { overlayClickBehavior: "close" },
  { overlayClickBehavior: "nextStep" },
  { overlayClickBehavior: "none" },
  { overlayClickBehavior: (element, step, opts) => opts.driver.moveNext() },
];

const driverObj: Driver = driver(config);
driver();

driverObj.drive();
driverObj.drive(2);
driverObj.moveNext();
driverObj.movePrevious();
driverObj.moveTo(1);
driverObj.refresh();
driverObj.setConfig({ ...driverObj.getConfig(), animate: false });
driverObj.setSteps(steps);
driverObj.highlight({ element: "#selector", popover: { title: "Highlight" } });
driverObj.destroy();

const flags: boolean[] = [
  driverObj.isActive(),
  driverObj.hasNextStep(),
  driverObj.hasPreviousStep(),
  driverObj.isFirstStep(),
  driverObj.isLastStep(),
];
const activeIndex: number | undefined = driverObj.getActiveIndex();
const activeStep: DriveStep | undefined = driverObj.getActiveStep();
const previousStep: DriveStep | undefined = driverObj.getPreviousStep();
const nextStep: DriveStep | undefined = driverObj.getNextStep();
const activeElement: Element | undefined = driverObj.getActiveElement();
const previousElement: Element | undefined = driverObj.getPreviousElement();
const currentConfig: Config = driverObj.getConfig();
const everything = driverObj.getState();
const oneKey = driverObj.getState("activeIndex");

const state: State = {};
const stateValues = [
  state.isInitialized,
  state.activeIndex,
  state.activeElement,
  state.activeStep,
  state.previousElement,
  state.previousStep,
  state.popover,
  state.__previousElement,
  state.__activeElement,
  state.__previousStep,
  state.__activeStep,
  state.__activeOnDestroyed,
  state.__resizeTimeout,
  state.__transitionCallback,
  state.__pendingWaitCancel,
  state.__destroyReason,
  state.__activeStagePosition,
  state.__overlaySvg,
  state.__events?.onKeyup,
  state.__events?.onKeydown,
  state.__events?.onResize,
  state.__events?.onScroll,
];

const confirmOnExit = driver({
  steps,
  onDestroyStarted: () => {
    if (!confirmOnExit.hasNextStep() || confirm("Are you sure?")) {
      confirmOnExit.destroy();
    }
  },
  onDestroyed: (element, step, { reason }) => {
    if (reason === "done") {
      void [element, step];
    }
  },
});

const beacon: HintBeacon = { side: "top", align: "end", animate: true, className: "mine", offsetX: 1, offsetY: 2 };
const hintHook: HintHook = (element, hint, opts) => {
  const el: Element = element;
  const current: DriverHint = hint;
  const hintsConfig: HintsConfig = opts.config;
  const instance: Hints = opts.hints;
  void [el, current, hintsConfig, instance];
};
const hintPopover: HintPopover = {
  title: "Title",
  description: "Description",
  side: "left" as HintSide,
  align: "start" as HintAlignment,
  popoverClass: "theme",
  showButton: true,
  buttonText: "Got it",
  onButtonClick: hintHook,
  onPopoverRender: (dom: HintPopoverDOM, opts) => {
    dom.wrapper.classList.add("x");
    opts.hints.close();
    void opts.hint.id;
  },
};
const hintList: DriverHint[] = [
  { element: "#a", id: "a", beacon, popover: hintPopover, onOpen: hintHook, onDismiss: hintHook, data: { a: 1 } },
  { element: document.body },
  { element: () => document.body },
];
const hintsObj: Hints = hints({
  hints: hintList,
  beacon,
  buttonText: "OK",
  popoverClass: "theme",
  popoverOffset: 10,
  overlay: true,
  overlayColor: "#000",
  overlayOpacity: 0.5,
  onOpen: hintHook,
  onDismiss: hintHook,
  onButtonClick: hintHook,
});
hints();
hintsObj.show();
hintsObj.hide();
hintsObj.open("a");
hintsObj.open(0);
hintsObj.close();
hintsObj.dismiss("a");
hintsObj.restore(0);
hintsObj.restoreAll();
hintsObj.setHints(hintList);
hintsObj.refresh();
const hintResults: [DriverHint[], DriverHint | undefined, boolean] = [
  hintsObj.getHints(),
  hintsObj.getActive(),
  hintsObj.isVisible(),
];

const position: ChecklistPosition = "bottom-right";
const itemHook: ChecklistItemHook = (item, opts) => {
  const current: ChecklistItem = item;
  const instance: Checklist = opts.checklist;
  void [current, instance];
};
const items: ChecklistItem[] = [
  { id: "tour", title: "Tour", description: "Steps", tour: steps },
  { id: "config", title: "Config", tour: config },
  { id: "driver", title: "Driver", tour: driverObj },
  { id: "link", title: "Link", href: "/docs" },
  { id: "action", title: "Action", action: itemHook, completeWhen: () => true, allowManualComplete: true, data: {} },
];
const checklistConfig: ChecklistConfig = {
  id: "onboarding",
  items,
  title: "Title",
  description: "Description",
  launcherText: "Open",
  completeTitle: "Done",
  completeDescription: "All done",
  completeLauncherText: "Done",
  progressText: "{{done}} of {{total}}",
  launcherProgressText: "{{done}}/{{total}}",
  position,
  launcher: true,
  offset: { x: 10, y: 10 },
  className: "mine",
  allowManualComplete: false,
  completed: ["tour"],
  onProgress: (progress: ChecklistProgress) => void [progress.completed, progress.done, progress.total],
  onItemComplete: itemHook,
  onComplete: opts => opts.checklist.hide(),
  onEvent: (event: ChecklistEvent) => {
    const type: ChecklistEventType = event.type;
    const reason: ChecklistDestroyReason | undefined = event.reason;
    void [event.kind, event.id, type, event.itemId, reason, event.timestamp];
  },
};
const checklistObj: Checklist = checklist(checklistConfig);
checklistObj.show();
checklistObj.hide();
checklistObj.open();
checklistObj.close();
checklistObj.toggle();
checklistObj.start("tour");
checklistObj.complete("tour");
checklistObj.uncomplete("tour");
checklistObj.reset();
checklistObj.refresh();
const checklistResults: [ChecklistProgress, ChecklistItem[], boolean, boolean] = [
  checklistObj.getProgress(),
  checklistObj.getItems(),
  checklistObj.isVisible(),
  checklistObj.isOpen(),
];

export {
  reasons,
  stage,
  overlayBehaviors,
  flags,
  activeIndex,
  activeStep,
  previousStep,
  nextStep,
  activeElement,
  previousElement,
  currentConfig,
  everything,
  oneKey,
  stateValues,
  hintResults,
  checklistResults,
};

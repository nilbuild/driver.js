import type { Alignment, AllowedButtons, PopoverDOM, Side } from "./popover/popover";
import type { StageDefinition } from "./overlay/stage";

export type DestroyReason = "done" | "close" | "escape" | "overlay" | "replaced" | "api";

export type HookOpts = {
  config: Config;
  state: State;
  driver: Driver;
  index: number | undefined;

  reason?: DestroyReason;

  signal?: AbortSignal;
};

export type DriverHook = (element: Element | undefined, step: DriveStep, opts: HookOpts) => void;

export type AdvanceOnOpts = HookOpts & {
  event: Event;
};

export type AdvanceOnEvent = {
  event: string | string[];
  when?: (element: Element, step: DriveStep, opts: AdvanceOnOpts) => boolean;

  strict?: boolean;
};

export type AdvanceOn = false | string | string[] | AdvanceOnEvent;

export type AllowedElements =
  | string
  | Element
  | Array<string | Element>
  | (() => Element[] | NodeListOf<Element> | null | undefined);

export type InteractionRegion = "element" | "allowed" | "outside";

export type InteractionOpts = HookOpts & {
  event: MouseEvent;
  region: InteractionRegion;
};

export type InteractionHook = (element: Element | undefined, step: DriveStep, opts: InteractionOpts) => false | void;

export type PopoverPatch = Pick<
  Popover,
  | "title"
  | "description"
  | "showButtons"
  | "disableButtons"
  | "showProgress"
  | "progressText"
  | "nextBtnText"
  | "prevBtnText"
  | "closeBtnLabel"
  | "popoverClass"
  | "instruction"
>;

export type ElementMissingOpts = HookOpts & {
  cause: "removed" | "timeout";
};

export type ElementMissingHook = (
  element: Element | undefined,
  step: DriveStep,
  opts: ElementMissingOpts
) => false | void;

export type WaitingForElementOpts = HookOpts & {
  signal: AbortSignal;
};

export type WaitingForElementHook = (
  element: Element | undefined,
  step: DriveStep,
  opts: WaitingForElementOpts
) => void;

// what has the keyboard when a step shows: the popover, the first thing to use inside the element, or whatever had it
export type StepFocus = "popover" | "element" | "none";

// where the element ends up when driver.js scrolls to it; what is left out keeps the default (centred, or its top at the
// top of the viewport when it is taller than the viewport)
export type ScrollIntoViewOpts = Pick<ScrollIntoViewOptions, "block" | "inline">;

export type ElementMissingPreset = "stay" | "previous" | "previousAction";
export type ElementMissing = ElementMissingPreset | ElementMissingHook;

export type Config = {
  steps?: DriveStep[];

  animate?: boolean;
  duration?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  smoothScroll?: boolean;
  scrollIntoView?: boolean | ScrollIntoViewOpts;
  allowClose?: boolean;
  allowScroll?: boolean;
  allowPageInteraction?: boolean;
  focus?: StepFocus;
  overlayClickBehavior?: "close" | "nextStep" | "none" | DriverHook;
  stagePadding?: number;
  stageRadius?: number;

  disableActiveInteraction?: boolean | "clicks";

  advanceOn?: AdvanceOn;
  /** @deprecated Use `advanceOn: "click"`. */
  advanceOnClick?: boolean;
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissing;
  onWaitingForElement?: WaitingForElementHook;
  onElementReplaced?: DriverHook;

  skipMissingElement?: boolean;

  waitForElement?: number;
  waitForRemovedElement?: number;

  advanceDelay?: number;

  allowKeyboardControl?: boolean;

  popoverClass?: string;
  popoverOffset?: number;
  showButtons?: AllowedButtons[];
  disableButtons?: AllowedButtons[];
  showProgress?: boolean;

  progressText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  closeBtnLabel?: string;

  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;
  onPopoverPositioned?: (popover: PopoverDOM, opts: HookOpts) => void;

  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  onDestroyStarted?: DriverHook;
  onDestroyed?: DriverHook;

  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;
};

export type Popover = {
  title?: string;
  description?: string;
  side?: Side;
  align?: Alignment;

  showButtons?: AllowedButtons[];
  showProgress?: boolean;
  disableButtons?: AllowedButtons[];

  popoverClass?: string;

  progressText?: string;
  doneBtnText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  closeBtnLabel?: string;

  instruction?: string;

  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;
  onPopoverPositioned?: (popover: PopoverDOM, opts: HookOpts) => void;

  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;
};

export type DriveStep = {
  element?: string | Element | (() => Element);
  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  popover?: Popover;
  disableActiveInteraction?: boolean | "clicks";
  allowPageInteraction?: boolean;
  focus?: StepFocus;
  advanceOn?: AdvanceOn;
  /** @deprecated Use `advanceOn: "click"`. */
  advanceOnClick?: boolean;
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissing;
  onWaitingForElement?: WaitingForElementHook;
  onElementReplaced?: DriverHook;
  skipMissingElement?: boolean;
  waitForElement?: number;
  waitForRemovedElement?: number;
  advanceDelay?: number;
  scrollIntoView?: boolean | ScrollIntoViewOpts;
  data?: Record<string, any>;
};

export interface Driver {
  isActive: () => boolean;
  refresh: () => void;
  drive: (stepIndex?: number) => void;
  setConfig: (config: Config) => void;
  setSteps: (steps: DriveStep[]) => void;
  getConfig: () => Config;
  getState: (key?: string) => any;
  getActiveIndex: () => number | undefined;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
  getActiveStep: () => DriveStep | undefined;
  getActiveElement: () => Element | undefined;
  getPreviousElement: () => Element | undefined;
  getPreviousStep: () => DriveStep | undefined;
  getNextStep: () => DriveStep | undefined;
  moveNext: () => void;
  movePrevious: () => void;
  moveTo: (index: number) => void;
  hasNextStep: () => boolean;
  hasPreviousStep: () => boolean;
  highlight: (step: DriveStep) => void;
  updatePopover: (patch?: PopoverPatch) => void;
  advance: () => void;
  nudge: (message?: string | PopoverPatch) => void;
  destroy: () => void;
}

export type State = {
  isInitialized?: boolean;

  activeIndex?: number;
  activeElement?: Element;
  activeStep?: DriveStep;
  previousElement?: Element;
  previousStep?: DriveStep;

  popover?: PopoverDOM;

  __previousElement?: Element;
  __activeElement?: Element;
  __previousStep?: DriveStep;
  __activeStep?: DriveStep;

  __activeOnDestroyed?: Element;
  __resizeTimeout?: number;
  __transitionCallback?: () => void;
  __pendingWaitCancel?: () => void;

  __destroyReason?: DestroyReason;
  __activeStagePosition?: StageDefinition;
  __overlaySvg?: SVGSVGElement;

  __events?: {
    onKeyup: (e: KeyboardEvent) => void;
    onKeydown: (e: KeyboardEvent) => void;
    onKeydownCapture: (e: KeyboardEvent) => void;
    onResize: () => void;
    onScroll: (e: Event) => void;
  };
};

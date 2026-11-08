import type { Driver, DriveStep } from "./driver";
import type { AllowedButtons, Popover, PopoverDOM } from "./popover";
import type { StageDefinition } from "./stage";

// Per-instance config, state and emitter, threaded through the helpers so
// nothing falls back to shared module-level state.

// Why a tour or highlight ended, passed to the hooks that run on destroy.
//   done     moved past the last step (next/done button, advanceOnClick, arrow key, moveNext)
//   close    the close button
//   escape   the escape key
//   overlay  a click on the overlay
//   replaced another driver instance started and took over the screen
//   api      destroy() or a navigation call that left the steps from your own code
export type DestroyReason = "done" | "close" | "escape" | "overlay" | "replaced" | "api";

export type HookOpts = {
  config: Config;
  state: State;
  driver: Driver;
  index: number | undefined;

  // Only set for onDestroyStarted, onDestroyed and the onDeselected that runs on destroy.
  reason?: DestroyReason;
};

export type DriverHook = (element: Element | undefined, step: DriveStep, opts: HookOpts) => void;

export type AdvanceOnOpts = HookOpts & {
  next: () => void;
  signal: AbortSignal;
};

export type AdvanceOn =
  | false
  | string
  | string[]
  | ((element: Element | undefined, step: DriveStep, opts: AdvanceOnOpts) => void | (() => void));

export type AllowedElements =
  | string
  | Element
  | Array<string | Element>
  | (() => Element[] | NodeListOf<Element> | null | undefined);

export type InteractionRegion = "element" | "allowed" | "outside";

export type InteractionOpts = HookOpts & {
  event: MouseEvent | KeyboardEvent;
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
>;

export type Activation = {
  step: DriveStep;
  controller: AbortController;
  cleanup?: () => void;
  latched: boolean;
  pendingCompletion?: boolean;
  recheck?: () => void;
  rebind?: () => void;
  popoverPatch?: PopoverPatch;
};

export type ElementMissingOpts = HookOpts & {
  cause: "removed" | "timeout";
};

export type ElementMissingHook = (element: Element | undefined, step: DriveStep, opts: ElementMissingOpts) => void;

export type Config = {
  steps?: DriveStep[];

  animate?: boolean;
  duration?: number;
  overlayColor?: string;
  overlayOpacity?: number;
  smoothScroll?: boolean;
  allowClose?: boolean;
  allowScroll?: boolean;
  overlayClickBehavior?: "close" | "nextStep" | "none" | DriverHook;
  stagePadding?: number;
  stageRadius?: number;

  disableActiveInteraction?: boolean;

  advanceOn?: AdvanceOn;
  /** @deprecated Use `advanceOn: "click"`. */
  advanceOnClick?: boolean;
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissingHook;

  // Skip a step whose target element is specified but missing from the DOM.
  // Element-less steps are intentional centered steps and never skipped. (default: false)
  skipMissingElement?: boolean;

  // Wait up to this many milliseconds for a step's missing element to appear
  // before falling back to the usual missing-element behaviour (centered
  // popover, or a skip when skipMissingElement is set). The current step
  // stays highlighted while waiting. (default: 0, off)
  waitForElement?: number;

  allowKeyboardControl?: boolean;

  // Popover specific configuration
  popoverClass?: string;
  popoverOffset?: number;
  showButtons?: AllowedButtons[];
  disableButtons?: AllowedButtons[];
  showProgress?: boolean;

  // Button texts
  progressText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  doneBtnText?: string;
  closeBtnLabel?: string;

  // Called after the popover is rendered
  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;

  // State based callbacks, called upon state changes
  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  onDestroyStarted?: DriverHook;
  onDestroyed?: DriverHook;

  // Event based callbacks, called upon events
  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;
};

export interface GetConfig {
  (): Config;
  <K extends keyof Config>(key: K): Config[K];
}

function createConfigStore() {
  let currentConfig: Config = {};

  function configure(config: Config = {}) {
    currentConfig = {
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
      ...config,
    };
  }

  const getConfig: GetConfig = (<K extends keyof Config>(key?: K) => {
    return key ? currentConfig[key] : currentConfig;
  }) as GetConfig;

  configure();

  return { getConfig, configure };
}

export type State = {
  isInitialized?: boolean;

  activeIndex?: number;
  activeElement?: Element;
  activeStep?: DriveStep;
  previousElement?: Element;
  previousStep?: DriveStep;

  popover?: PopoverDOM;

  // actual values considering the animation
  // and delays. These are used to determine
  // the positions etc.
  __previousElement?: Element;
  __activeElement?: Element;
  __previousStep?: DriveStep;
  __activeStep?: DriveStep;

  __activeOnDestroyed?: Element;
  __resizeTimeout?: number;
  __transitionCallback?: () => void;
  __pendingWaitCancel?: () => void;
  __activation?: Activation;
  __liveRegion?: HTMLElement;
  __rejectedKeys?: Set<string>;
  __handledKeys?: Set<string>;
  __widgetKey?: string;
  __teardownGate?: () => void;
  __syncAllowedElements?: () => void;
  __initialWait?: { element: Element; step: DriveStep; index: number };
  __isWaiting?: boolean;
  __keepReturnFocus?: boolean;
  __lastAnnouncement?: string;

  // User action a destroy() called from a hook reports instead of "api".
  __destroyReason?: DestroyReason;
  __activeStagePosition?: StageDefinition;
  __overlaySvg?: SVGSVGElement;

  __events?: {
    onKeyup: (e: KeyboardEvent) => void;
    onKeydown: (e: KeyboardEvent) => void;
    onKeydownCapture: (e: KeyboardEvent) => void;
    onResize: () => void;
    onScroll: () => void;
  };
};

export interface GetState {
  (): State;
  <K extends keyof State>(key: K): State[K];
}

export type SetState = <K extends keyof State>(key: K, value: State[K]) => void;

function createStateStore() {
  let currentState: State = {};

  const getState: GetState = (<K extends keyof State>(key?: K) => {
    return key ? currentState[key] : currentState;
  }) as GetState;

  const setState: SetState = (key, value) => {
    currentState[key] = value;
  };

  function resetState() {
    currentState = {};
  }

  return { getState, setState, resetState };
}

type allowedEvents =
  | "overlayClick"
  | "escapePress"
  | "nextClick"
  | "prevClick"
  | "closeClick"
  | "arrowRightPress"
  | "arrowLeftPress";

function createEmitter() {
  let registeredListeners: Partial<{ [key in allowedEvents]: () => void }> = {};

  function listen(hook: allowedEvents, callback: () => void) {
    registeredListeners[hook] = callback;
  }

  function emit(hook: allowedEvents) {
    registeredListeners[hook]?.();
  }

  function reset() {
    registeredListeners = {};
  }

  return { listen, emit, reset };
}

export type Context = {
  getConfig: GetConfig;
  setConfig: (config?: Config) => void;

  getState: GetState;
  setState: SetState;
  resetState: () => void;

  listen: (hook: allowedEvents, callback: () => void) => void;
  emit: (hook: allowedEvents) => void;
  resetEmitter: () => void;

  getDriver: () => Driver;
  setDriver: (driver: Driver) => void;

  getHookOpts: (stateOverride?: State, reason?: DestroyReason) => HookOpts;

  consume: (event: Event) => void;
  isConsumed: (event: Event) => boolean;
};

export function createContext(options: Config = {}): Context {
  const config = createConfigStore();
  config.configure(options);

  const state = createStateStore();
  const emitter = createEmitter();

  let driver: Driver;
  const consumedEvents = new WeakSet<Event>();

  return {
    getConfig: config.getConfig,
    setConfig: config.configure,

    getState: state.getState,
    setState: state.setState,
    resetState: state.resetState,

    listen: emitter.listen,
    emit: emitter.emit,
    resetEmitter: emitter.reset,

    getDriver: () => driver,
    setDriver: (value: Driver) => {
      driver = value;
    },

    getHookOpts: (stateOverride?: State, reason?: DestroyReason) => {
      const activeState = stateOverride || state.getState();

      return {
        config: config.getConfig(),
        state: activeState,
        driver,
        index: activeState.activeIndex,
        ...(reason ? { reason } : {}),
      };
    },

    consume: (event: Event) => {
      consumedEvents.add(event);
    },
    isConsumed: (event: Event) => consumedEvents.has(event),
  };
}

import type { Config, DestroyReason, Driver, DriveStep, HookOpts, PopoverPatch, State } from "../types";
import type { Renderer } from "./renderer";

export type {
  AdvanceOn,
  AdvanceOnEvent,
  AdvanceOnOpts,
  AllowedElements,
  Config,
  DestroyReason,
  DriverHook,
  ElementMissingHook,
  ElementMissingOpts,
  HookOpts,
  InteractionHook,
  InteractionOpts,
  InteractionRegion,
  PopoverPatch,
  State,
} from "../types";

export type StepWait = "initial" | "next" | "missing";

export type Activation = {
  step: DriveStep;
  controller: AbortController;
  placeholder?: { element?: Element; index: number };
  wait?: StepWait;
  waitController?: AbortController;
  latched: boolean;
  settling?: boolean;
  done?: boolean;
  recheck?: () => void;
  popoverPatch?: PopoverPatch;
  feedback?: string;
};

export type InternalState = State & {
  __resizeObserver?: ResizeObserver;
  __openObserver?: MutationObserver;
  __refreshMissed?: boolean;
  __advanceClick?: MouseEvent;
  __marked?: { element: Element; parent?: Element };
  __activation?: Activation;
  __liveRegion?: HTMLElement;
  __handledKeys?: Set<string>;
  __pressedKeys?: Map<string, Activation | undefined>;
  __widgetKey?: string;
  __teardownGate?: () => void;
  __syncAllowedElements?: () => void;
  __keepReturnFocus?: boolean;
  __lastAnnouncement?: string;
};

export type CoreActions = {
  drive: (stepIndex?: number, hasWaitedForElement?: boolean) => void;
  next: () => void;
  moveNext: () => void;
  movePrevious: () => void;
  close: () => void;
  destroy: (reason: DestroyReason) => void;
  refreshPopover: () => void;
};

export type ControlActions = {
  pressNext: () => void;
  previous: () => void;
  requestClose: () => void;
  overlayClick: () => void;
  escape: () => void;
  arrowLeft: () => void;
  arrowRight: () => void;
};

export type TourActions = CoreActions & ControlActions;

export type Context = {
  tour: TourActions;
  ui: Renderer;

  config: Config;
  state: InternalState;
  driver?: Driver;
  consumed: WeakSet<Event>;
};

export function configure(ctx: Pick<Context, "config">, config: Config = {}) {
  ctx.config = {
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

export function hookOpts(ctx: Context, stateOverride?: State, reason?: DestroyReason): HookOpts {
  const activeState = stateOverride || ctx.state;

  return {
    config: ctx.config,
    state: activeState,
    driver: ctx.driver!,
    index: activeState.activeIndex,
    ...(reason ? { reason } : {}),
  };
}

export function createContext(options: Config, ui: Renderer, core: CoreActions): Context {
  const ctx: Context = { tour: core as TourActions, ui, config: {}, state: {}, consumed: new WeakSet() };
  configure(ctx, options);
  Object.assign(ctx.tour, ui.controls?.(ctx));

  return ctx;
}

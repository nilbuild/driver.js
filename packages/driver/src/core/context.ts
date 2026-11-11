import type { Config, DestroyReason, Driver, DriveStep, HookOpts, PopoverPatch, State } from "../types";

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
  placeholder?: { element: Element; index: number };
  wait?: StepWait;
  latched: boolean;
  settling?: boolean;
  done?: boolean;
  recheck?: () => void;
  popoverPatch?: PopoverPatch;
  feedback?: string;
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

export type InternalState = State & {
  __resizeObserver?: ResizeObserver;
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

export interface GetState {
  (): InternalState;
  <K extends keyof InternalState>(key: K): InternalState[K];
}

export type SetState = <K extends keyof InternalState>(key: K, value: InternalState[K]) => void;

function createStateStore() {
  let currentState: InternalState = {};

  const getState: GetState = (<K extends keyof InternalState>(key?: K) => {
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

export type TourActions = {
  drive: (stepIndex?: number, hasWaitedForElement?: boolean) => void;
  next: () => void;
  pressNext: () => void;
  previous: () => void;
  moveNext: () => void;
  movePrevious: () => void;
  close: () => void;
  requestClose: () => void;
  overlayClick: () => void;
  escape: () => void;
  arrowLeft: () => void;
  arrowRight: () => void;
  refreshPopover: () => void;
};

export type Context = {
  tour: TourActions;

  getConfig: GetConfig;
  setConfig: (config?: Config) => void;

  getState: GetState;
  setState: SetState;
  resetState: () => void;

  setDriver: (driver: Driver) => void;

  getHookOpts: (stateOverride?: State, reason?: DestroyReason) => HookOpts;

  consume: (event: Event) => void;
  isConsumed: (event: Event) => boolean;
};

export function createContext(options: Config = {}): Omit<Context, "tour"> {
  const config = createConfigStore();
  config.configure(options);

  const state = createStateStore();

  let driver: Driver;
  const consumedEvents = new WeakSet<Event>();

  return {
    getConfig: config.getConfig,
    setConfig: config.configure,

    getState: state.getState,
    setState: state.setState,
    resetState: state.resetState,

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

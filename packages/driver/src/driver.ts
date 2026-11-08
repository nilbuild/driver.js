import { AllowedButtons, destroyPopover, hidePopover, Popover } from "./popover";
import { destroyOverlay } from "./overlay";
import { destroyEvents, initEvents, requireRefresh } from "./events";
import { Activation, AdvanceOn, Config, createContext, DestroyReason, DriverHook } from "./context";
import { listenForAdvanceEvents, resolveAdvanceOn } from "./advance";
import { destroyHighlight, highlight } from "./highlight";
import {
  findReachableIndex,
  resolveNextHook,
  resolvePrevHook,
  resolveStepButtons,
  resolveTourStep,
  shouldSkipStep,
} from "./step";
import { resolveElement } from "./utils";
import "./driver.css";

let teardownActive: (() => void) | undefined;

// Re-export the public types so they remain part of the package's type surface.
export type { AdvanceOn, AdvanceOnOpts, Config, DestroyReason, DriverHook, HookOpts, State } from "./context";
export type { StageDefinition } from "./stage";
export type { Popover, PopoverDOM, Side, Alignment, AllowedButtons } from "./popover";

export type DriveStep = {
  element?: string | Element | (() => Element);
  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  popover?: Popover;
  disableActiveInteraction?: boolean;
  advanceOnClick?: boolean;
  advanceOn?: AdvanceOn;
  skipMissingElement?: boolean;
  waitForElement?: number;
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
  destroy: () => void;
}

export function driver(options: Config = {}): Driver {
  const ctx = createContext(options);
  const teardown = () => destroy("replaced", false);
  let activationCount = 0;

  function handleClose(reason: DestroyReason = "close") {
    if (!ctx.getConfig("allowClose")) {
      return;
    }

    destroy(reason);
  }

  // Before handing the next action to a user hook on the last step, so a
  // destroy() from that hook still reports the tour as done.
  function markDoneIfLastStep() {
    const activeIndex = ctx.getState("activeIndex");
    if (activeIndex !== undefined && findReachableIndex(ctx, activeIndex + 1, 1) === undefined) {
      ctx.setState("__destroyReason", "done");
    }
  }

  function handleEscape() {
    const { disableButtons } = resolveStepButtons(ctx, ctx.getState("__activeStep"));
    if (disableButtons.includes("close")) {
      return;
    }

    handleClose("escape");
  }

  function canUseButton(button: AllowedButtons) {
    const { showButtons, disableButtons } = resolveStepButtons(ctx, ctx.getState("__activeStep"));

    return showButtons.includes(button) && !disableButtons.includes(button);
  }

  function handleOverlayClick() {
    const overlayClickBehavior = ctx.getConfig("overlayClickBehavior");

    if (ctx.getConfig("allowClose") && overlayClickBehavior === "close") {
      destroy("overlay");
      return;
    }

    if (typeof overlayClickBehavior === "function") {
      ctx.setState("__destroyReason", "overlay");

      const activeStep = ctx.getState("__activeStep");
      const activeElement = ctx.getState("__activeElement");

      overlayClickBehavior(activeElement, activeStep!, ctx.getHookOpts());

      return;
    }

    if (overlayClickBehavior === "nextStep") {
      const activeStep = ctx.getState("activeStep");
      const activeElement = ctx.getState("activeElement");

      const onNextClick = resolveNextHook(ctx, activeStep);
      if (onNextClick) {
        markDoneIfLastStep();
        onNextClick(activeElement, activeStep!, ctx.getHookOpts());
        return;
      }

      moveNext();
    }
  }

  function moveNext() {
    const activeIndex = ctx.getState("activeIndex");
    const steps = ctx.getConfig("steps") || [];
    if (typeof activeIndex === "undefined") {
      return;
    }

    const nextStepIndex = activeIndex + 1;
    if (steps[nextStepIndex]) {
      drive(nextStepIndex);
    } else {
      destroy("done");
    }
  }

  function movePrevious() {
    const activeIndex = ctx.getState("activeIndex");
    const steps = ctx.getConfig("steps") || [];
    if (typeof activeIndex === "undefined") {
      return;
    }

    const previousStepIndex = activeIndex - 1;
    if (steps[previousStepIndex]) {
      drive(previousStepIndex);
    } else {
      destroy("api");
    }
  }

  function moveTo(index: number) {
    const steps = ctx.getConfig("steps") || [];

    if (steps[index]) {
      drive(index);
    } else {
      destroy("api");
    }
  }

  function advance() {
    const activeStep = ctx.getState("activeStep");
    if (!activeStep) {
      return;
    }

    const activeElement = ctx.getState("activeElement");
    const onNextClick = resolveNextHook(ctx, activeStep);
    if (onNextClick) {
      markDoneIfLastStep();
      onNextClick(activeElement, activeStep, ctx.getHookOpts());
      return;
    }

    moveNext();
  }

  function requestCompletion(activationId: number) {
    const activation = ctx.getState("__activation");
    if (!activation || activation.id !== activationId || activation.latched) {
      return;
    }

    activation.latched = true;
    advance();

    if (ctx.getState("__activation") === activation && !ctx.getState("__pendingWaitCancel")) {
      activation.latched = false;
    }
  }

  function endActivation() {
    const activation = ctx.getState("__activation");
    if (!activation) {
      return;
    }

    ctx.setState("__activation", undefined);
    activation.controller.abort();
    activation.cleanup?.();
  }

  function startActivation() {
    endActivation();

    const step = ctx.getState("activeStep");
    if (!step) {
      return;
    }

    activationCount += 1;
    const activation: Activation = { id: activationCount, controller: new AbortController(), latched: false };
    ctx.setState("__activation", activation);

    const advanceOn = resolveAdvanceOn(ctx, step);
    if (!advanceOn) {
      return;
    }

    const complete = () => requestCompletion(activation.id);
    if (typeof advanceOn !== "function") {
      const eventTypes = Array.isArray(advanceOn) ? advanceOn : [advanceOn];
      listenForAdvanceEvents(ctx, eventTypes, activation.controller.signal, complete);
      return;
    }

    const element = ctx.getState("activeElement");
    const isDummyElement = !element || element.id === "driver-dummy-element";
    const cleanup = advanceOn(isDummyElement ? undefined : element, step, {
      ...ctx.getHookOpts(),
      next: complete,
      signal: activation.controller.signal,
    });

    if (typeof cleanup !== "function") {
      return;
    }

    if (ctx.getState("__activation") === activation) {
      activation.cleanup = cleanup;
    } else {
      cleanup();
    }
  }

  function handleArrowLeft() {
    const isTransitioning = ctx.getState("__transitionCallback");
    if (isTransitioning) {
      return;
    }

    const activeIndex = ctx.getState("activeIndex");
    const activeStep = ctx.getState("__activeStep");
    const activeElement = ctx.getState("__activeElement");
    if (typeof activeIndex === "undefined" || typeof activeStep === "undefined") {
      return;
    }

    const steps = ctx.getConfig("steps") || [];
    if (!steps[activeIndex - 1]) {
      return;
    }

    if (!canUseButton("previous")) {
      return;
    }

    const onPrevClick = resolvePrevHook(ctx, activeStep);
    if (onPrevClick) {
      return onPrevClick(activeElement, activeStep, ctx.getHookOpts());
    }

    movePrevious();
  }

  function handleArrowRight() {
    const isTransitioning = ctx.getState("__transitionCallback");
    if (isTransitioning) {
      return;
    }

    const activeIndex = ctx.getState("activeIndex");
    const activeStep = ctx.getState("__activeStep");
    const activeElement = ctx.getState("__activeElement");
    if (typeof activeIndex === "undefined" || typeof activeStep === "undefined") {
      return;
    }

    if (!canUseButton("next")) {
      return;
    }

    const onNextClick = resolveNextHook(ctx, activeStep);
    if (onNextClick) {
      markDoneIfLastStep();
      return onNextClick(activeElement, activeStep, ctx.getHookOpts());
    }

    moveNext();
  }

  function init() {
    if (ctx.getState("isInitialized")) {
      return;
    }

    if (teardownActive && teardownActive !== teardown) {
      teardownActive();
    }
    teardownActive = teardown;

    ctx.setState("isInitialized", true);
    document.body.classList.add("driver-active", ctx.getConfig("animate") ? "driver-fade" : "driver-simple");
    if (!ctx.getConfig("allowScroll")) {
      document.body.classList.add("driver-no-scroll");
    }
    document.body.style.setProperty("--driver-animation-duration", `${ctx.getConfig("duration") || 400}ms`);

    initEvents(ctx);

    ctx.listen("overlayClick", handleOverlayClick);
    ctx.listen("escapePress", handleEscape);
    ctx.listen("closeClick", handleClose);
    ctx.listen("arrowLeftPress", handleArrowLeft);
    ctx.listen("arrowRightPress", handleArrowRight);
  }

  function cancelElementWait() {
    const cancel = ctx.getState("__pendingWaitCancel");
    if (!cancel) {
      return;
    }

    ctx.setState("__pendingWaitCancel", undefined);
    cancel();
  }

  // Re-resolves the step's element on every DOM mutation rather than polling;
  // this also covers function elements, since they query the mutated DOM.
  function waitForStepElement(step: DriveStep, timeout: number, onSettled: () => void) {
    const settle = () => {
      observer.disconnect();
      window.clearTimeout(timer);
      ctx.setState("__pendingWaitCancel", undefined);
      onSettled();
    };

    const observer = new MutationObserver(() => {
      if (resolveElement(step.element)) {
        settle();
      }
    });

    const timer = window.setTimeout(settle, timeout);

    ctx.setState("__pendingWaitCancel", () => {
      observer.disconnect();
      window.clearTimeout(timer);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  function drive(stepIndex: number = 0, hasWaitedForElement = false) {
    cancelElementWait();

    ctx.setState("__destroyReason", undefined);

    const steps = ctx.getConfig("steps");
    if (!steps) {
      console.error("No steps to drive through");
      destroy("api");
      return;
    }

    if (!steps[stepIndex]) {
      destroy("api");

      return;
    }

    const currentStep = steps[stepIndex];

    // The current step stays highlighted, with its popover hidden, while
    // waiting; a timeout falls through to the usual missing-element handling below.
    const waitTimeout = currentStep.waitForElement ?? ctx.getConfig("waitForElement") ?? 0;
    if (!hasWaitedForElement && waitTimeout > 0 && currentStep.element && !resolveElement(currentStep.element)) {
      hidePopover(ctx.getState("popover"));
      waitForStepElement(currentStep, waitTimeout, () => drive(stepIndex, true));
      return;
    }

    if (shouldSkipStep(ctx, currentStep)) {
      const activeIndex = ctx.getState("activeIndex");
      const direction = typeof activeIndex === "number" && stepIndex < activeIndex ? -1 : 1;

      if (steps[stepIndex + direction]) {
        drive(stepIndex + direction);
      } else if (direction === 1) {
        destroy("done");
      }

      return;
    }

    ctx.setState("__activeOnDestroyed", document.activeElement as HTMLElement);
    ctx.setState("activeIndex", stepIndex);

    const hasNextStep = steps[stepIndex + 1];

    highlight(
      ctx,
      resolveTourStep(ctx, stepIndex, {
        onNextClick: () => {
          if (!hasNextStep) {
            destroy("done");
          } else {
            drive(stepIndex + 1);
          }
        },
        onPrevClick: () => {
          drive(stepIndex - 1);
        },
        onCloseClick: () => {
          destroy("close");
        },
      })
    );

    startActivation();
  }

  function destroy(reason: DestroyReason, withOnDestroyStartedHook = true) {
    if (!ctx.getState("isInitialized")) {
      return;
    }

    if (reason === "api") {
      reason = ctx.getState("__destroyReason") ?? "api";
    }

    const activeElement = ctx.getState("__activeElement");
    const activeStep = ctx.getState("__activeStep");

    const activeOnDestroyed = ctx.getState("__activeOnDestroyed");

    const onDestroyStarted = ctx.getConfig("onDestroyStarted");
    // `onDestroyStarted` is used to confirm the exit of tour. If we trigger
    // the hook for when user calls `destroy`, driver will get into infinite loop
    // not causing tour to be destroyed.
    if (withOnDestroyStartedHook && onDestroyStarted) {
      ctx.setState("__destroyReason", reason);

      const isActiveDummyElement = !activeElement || activeElement?.id === "driver-dummy-element";
      onDestroyStarted(
        isActiveDummyElement ? undefined : activeElement,
        activeStep!,
        ctx.getHookOpts(undefined, reason)
      );
      return;
    }

    if (teardownActive === teardown) {
      teardownActive = undefined;
    }

    const onDeselected = activeStep?.onDeselected || ctx.getConfig("onDeselected");
    const onDestroyed = ctx.getConfig("onDestroyed");

    document.body.classList.remove("driver-active", "driver-fade", "driver-simple", "driver-no-scroll");
    document.body.style.removeProperty("--driver-animation-duration");

    cancelElementWait();
    endActivation();
    destroyEvents(ctx);
    destroyPopover(ctx.getState("popover"));
    destroyHighlight();
    destroyOverlay(ctx);
    ctx.resetEmitter();

    const stateBeforeDestroy = ctx.getState();

    ctx.resetState();

    if (activeElement && activeStep) {
      const isActiveDummyElement = activeElement.id === "driver-dummy-element";
      if (onDeselected) {
        onDeselected(
          isActiveDummyElement ? undefined : activeElement,
          activeStep,
          ctx.getHookOpts(stateBeforeDestroy, reason)
        );
      }

      if (onDestroyed) {
        onDestroyed(
          isActiveDummyElement ? undefined : activeElement,
          activeStep,
          ctx.getHookOpts(stateBeforeDestroy, reason)
        );
      }
    }

    if (activeOnDestroyed) {
      (activeOnDestroyed as HTMLElement).focus();
    }
  }

  const api: Driver = {
    isActive: () => ctx.getState("isInitialized") || false,
    refresh: () => requireRefresh(ctx),
    drive: (stepIndex: number = 0) => {
      init();
      drive(stepIndex);
    },
    setConfig: ctx.setConfig,
    setSteps: (steps: DriveStep[]) => {
      cancelElementWait();
      endActivation();
      ctx.resetState();
      ctx.setConfig({
        ...ctx.getConfig(),
        steps,
      });
    },
    getConfig: ctx.getConfig,
    getState: ctx.getState,
    getActiveIndex: () => ctx.getState("activeIndex"),
    isFirstStep: () => {
      const activeIndex = ctx.getState("activeIndex");

      return activeIndex !== undefined && findReachableIndex(ctx, activeIndex - 1, -1) === undefined;
    },
    isLastStep: () => {
      const activeIndex = ctx.getState("activeIndex");

      return activeIndex !== undefined && findReachableIndex(ctx, activeIndex + 1, 1) === undefined;
    },
    getActiveStep: () => ctx.getState("activeStep"),
    getActiveElement: () => ctx.getState("activeElement"),
    getPreviousElement: () => ctx.getState("previousElement"),
    getPreviousStep: () => ctx.getState("previousStep"),
    getNextStep: () => {
      const steps = ctx.getConfig("steps") || [];
      const activeIndex = ctx.getState("activeIndex");
      if (activeIndex === undefined) {
        return undefined;
      }

      const nextIndex = findReachableIndex(ctx, activeIndex + 1, 1);

      return nextIndex !== undefined ? steps[nextIndex] : undefined;
    },
    moveNext,
    movePrevious,
    moveTo,
    hasNextStep: () => {
      const activeIndex = ctx.getState("activeIndex");

      return activeIndex !== undefined && findReachableIndex(ctx, activeIndex + 1, 1) !== undefined;
    },
    hasPreviousStep: () => {
      const activeIndex = ctx.getState("activeIndex");

      return activeIndex !== undefined && findReachableIndex(ctx, activeIndex - 1, -1) !== undefined;
    },
    highlight: (step: DriveStep) => {
      init();
      ctx.setState("__destroyReason", undefined);
      highlight(ctx, {
        ...step,
        popover: step.popover
          ? {
              showButtons: [],
              showProgress: false,
              progressText: "",
              ...step.popover!,
            }
          : undefined,
      });
      startActivation();
    },
    destroy: () => {
      destroy("api", false);
    },
  };

  ctx.setDriver(api);

  return api;
}

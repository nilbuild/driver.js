import { AllowedButtons, destroyPopover, Popover } from "./popover";
import { destroyOverlay } from "./overlay";
import { destroyEvents, initEvents, requireRefresh } from "./events";
import {
  Activation,
  AdvanceOn,
  AllowedElements,
  Config,
  createContext,
  DestroyReason,
  DriverHook,
  ElementMissingHook,
  InteractionHook,
  PopoverPatch,
} from "./context";
import { announce, destroyLiveRegion, mountLiveRegion } from "./live-region";
import { listenForAdvanceEvents, resolveAdvanceOn } from "./advance";
import { isDummyElement } from "./gate";
import { nudge, NudgeTarget } from "./nudge";
import { trackAllowedElements } from "./allowed";
import { destroyHighlight, highlight, mountDummyElement, rebindActiveElement } from "./highlight";
import {
  findReachableIndex,
  resolveNextHook,
  resolvePrevHook,
  resolveStepButtons,
  clearStepPopoverWaiting,
  isPopoverWaiting,
  markStepPopoverWaiting,
  withPopoverPatch,
  renderStepPopover,
  resolveTourStep,
  shouldSkipStep,
  updateStepPopover,
} from "./step";
import { resolveElement } from "./utils";
import "./driver.css";

let teardownActive: (() => void) | undefined;

// Re-export the public types so they remain part of the package's type surface.
export type {
  AdvanceOn,
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
} from "./context";
export type { StageDefinition } from "./stage";
export type { NudgeTarget } from "./nudge";
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
  onInteraction?: InteractionHook;
  allowedElements?: AllowedElements;
  onElementMissing?: ElementMissingHook;
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
  updatePopover: (patch?: PopoverPatch) => void;
  nudge: (target?: NudgeTarget) => void;
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
    const step = currentPopoverStep();
    const { disableButtons } = resolveStepButtons(ctx, step ? withPopoverPatch(ctx, step) : step);
    if (disableButtons.includes("close")) {
      return;
    }

    handleClose("escape");
  }

  function currentPopoverStep(): DriveStep | undefined {
    return ctx.getState("__initialWait")?.step ?? ctx.getState("__activeStep");
  }

  function canUseButton(button: AllowedButtons) {
    if (button !== "close" && isPopoverWaiting(ctx)) {
      return false;
    }

    const step = currentPopoverStep();
    const { showButtons, disableButtons } = resolveStepButtons(ctx, step ? withPopoverPatch(ctx, step) : step);

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

    releaseLatch(activation);
  }

  function releaseLatch(activation: Activation) {
    if (ctx.getState("__activation") !== activation || ctx.getState("__pendingWaitCancel")) {
      return;
    }

    activation.latched = false;
    activation.recheck?.();
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

  function resolveMissingHook(step: DriveStep): ElementMissingHook | undefined {
    return step.onElementMissing || ctx.getConfig("onElementMissing");
  }

  function clearWaiting() {
    const initialWait = ctx.getState("__initialWait");
    const element = initialWait?.element ?? ctx.getState("activeElement");
    const step = initialWait?.step ?? ctx.getState("activeStep");
    clearStepPopoverWaiting(ctx, element, step);
  }

  function watchForRemoval(activation: Activation) {
    const { step } = activation;
    const { signal } = activation.controller;
    if (!step.element || !resolveMissingHook(step)) {
      return;
    }

    let frame: number | undefined;
    let graceTimer: number | undefined;
    let hasReported = false;

    const recover = () => {
      const replacement = resolveElement(step.element);
      if (!replacement || !replacement.isConnected) {
        return false;
      }

      window.clearTimeout(graceTimer);
      graceTimer = undefined;
      hasReported = false;
      rebindActiveElement(ctx, replacement);
      activation.rebind?.();
      if (!activation.latched && !ctx.getState("__pendingWaitCancel")) {
        clearWaiting();
      }
      return true;
    };

    const report = (element: Element) => {
      hasReported = true;
      clearWaiting();
      resolveMissingHook(step)?.(element, step, { ...ctx.getHookOpts(), cause: "removed" });
    };

    const check = () => {
      frame = undefined;
      const element = ctx.getState("activeElement");
      if (signal.aborted || !element || isDummyElement(element)) {
        return;
      }

      if (element.isConnected) {
        if (hasReported || graceTimer !== undefined) {
          window.clearTimeout(graceTimer);
          graceTimer = undefined;
          hasReported = false;
          rebindActiveElement(ctx, element);
          activation.rebind?.();
          if (!activation.latched && !ctx.getState("__pendingWaitCancel")) {
            clearWaiting();
          }
        }

        return;
      }

      if (activation.latched || activation.pendingCompletion || recover() || hasReported || graceTimer) {
        return;
      }

      const grace = step.waitForElement ?? ctx.getConfig("waitForElement") ?? 0;
      if (grace <= 0) {
        report(element);
        return;
      }

      markStepPopoverWaiting(ctx);
      graceTimer = window.setTimeout(() => {
        graceTimer = undefined;
        if (signal.aborted || activation.latched || activation.pendingCompletion || recover()) {
          return;
        }

        report(element);
      }, grace);
    };

    const schedule = () => {
      if (frame === undefined) {
        frame = window.requestAnimationFrame(check);
      }
    };

    const observer = new MutationObserver(schedule);
    observer.observe(document.documentElement, { childList: true, subtree: true });
    activation.recheck = schedule;

    signal.addEventListener("abort", () => {
      observer.disconnect();
      window.clearTimeout(graceTimer);
      if (frame !== undefined) {
        window.cancelAnimationFrame(frame);
      }
    });
  }

  function beginActivation(step: DriveStep): Activation {
    endActivation();

    activationCount += 1;
    const activation: Activation = { id: activationCount, step, controller: new AbortController(), latched: false };
    ctx.setState("__activation", activation);

    return activation;
  }

  function armActivation(activation: Activation) {
    if (ctx.getState("__activation") !== activation) {
      return;
    }

    const { step } = activation;
    trackAllowedElements(ctx, step, activation.controller.signal);
    watchForRemoval(activation);

    const advanceOn = resolveAdvanceOn(ctx, step);
    if (!advanceOn) {
      return;
    }

    const complete = () => requestCompletion(activation.id);
    if (typeof advanceOn !== "function") {
      const eventTypes = Array.isArray(advanceOn) ? advanceOn : [advanceOn];
      listenForAdvanceEvents(ctx, eventTypes, activation, complete);
      return;
    }

    let unbind: (() => void) | undefined;
    const bind = () => {
      unbind?.();
      const binding = new AbortController();
      const stop = () => binding.abort();
      activation.controller.signal.addEventListener("abort", stop);

      const element = ctx.getState("activeElement");
      const cleanup = advanceOn(isDummyElement(element) ? undefined : element, step, {
        ...ctx.getHookOpts(),
        next: complete,
        signal: binding.signal,
      });

      unbind = () => {
        activation.controller.signal.removeEventListener("abort", stop);
        binding.abort();
        if (typeof cleanup === "function") {
          cleanup();
        }
      };

      if (ctx.getState("__activation") !== activation) {
        unbind();
      }
    };

    bind();
    activation.rebind = bind;
    activation.cleanup = () => unbind?.();
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

  function popoverText() {
    const popover = ctx.getState("popover");
    if (!popover) {
      return { title: "", description: "" };
    }

    const visibleText = (element: HTMLElement) => (element.style.display === "none" ? "" : element.textContent || "");

    return { title: visibleText(popover.title), description: visibleText(popover.description) };
  }

  function updatePopover(patch?: PopoverPatch) {
    const activation = ctx.getState("__activation");
    if (!activation) {
      return;
    }

    activation.popoverPatch = patch ? { ...activation.popoverPatch, ...patch } : undefined;

    const popover = ctx.getState("popover");
    const initialWait = ctx.getState("__initialWait");
    const element = initialWait?.element ?? ctx.getState("activeElement");
    const currentStep = initialWait?.step ?? ctx.getState("activeStep");
    if (!popover || !element || currentStep !== activation.step) {
      return;
    }

    if (popover.wrapper.style.display === "none" || !popover.wrapper.isConnected) {
      return;
    }

    const wasWaiting = isPopoverWaiting(ctx);
    const before = popoverText();
    updateStepPopover(ctx, element, activation.step);
    if (wasWaiting) {
      markStepPopoverWaiting(ctx);
    }
    const after = popoverText();

    const changed = [
      after.title !== before.title ? after.title : "",
      after.description !== before.description ? after.description : "",
    ];
    announce(ctx, changed.filter(Boolean).join(". "));
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
    mountLiveRegion(ctx);

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
  function waitForStepElement(step: DriveStep, timeout: number, onSettled: (found: boolean) => void) {
    const originating = ctx.getState("__activation");

    const settle = (found: boolean) => {
      observer.disconnect();
      window.clearTimeout(timer);
      ctx.setState("__pendingWaitCancel", undefined);
      onSettled(found);

      if (originating) {
        releaseLatch(originating);
      }
    };

    const observer = new MutationObserver(() => {
      if (resolveElement(step.element)) {
        settle(true);
      }
    });

    const timer = window.setTimeout(() => settle(false), timeout);

    ctx.setState("__pendingWaitCancel", () => {
      observer.disconnect();
      window.clearTimeout(timer);
    });

    observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
  }

  function resolveStepAt(stepIndex: number): DriveStep {
    const steps = ctx.getConfig("steps") || [];
    const hasNextStep = steps[stepIndex + 1];

    return resolveTourStep(ctx, stepIndex, {
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
    });
  }

  function showInitialWait(stepIndex: number) {
    const step = resolveStepAt(stepIndex);
    if (!step.popover) {
      return;
    }

    const element = mountDummyElement();
    ctx.setState("activeIndex", stepIndex);
    ctx.setState("__initialWait", { element, step, index: stepIndex });
    beginActivation(step);
    renderStepPopover(ctx, element, step);
    markStepPopoverWaiting(ctx);
  }

  function endInitialWait() {
    if (!ctx.getState("__initialWait")) {
      return;
    }

    ctx.setState("__initialWait", undefined);
    destroyPopover(ctx.getState("popover"));
    ctx.setState("popover", undefined);
    document.getElementById("driver-dummy-element")?.remove();
  }

  function handleWaitTimeout(stepIndex: number) {
    const waitedStep = resolveStepAt(stepIndex);
    const onElementMissing = resolveMissingHook(waitedStep);
    if (!onElementMissing) {
      drive(stepIndex, true);
      return;
    }

    clearWaiting();
    onElementMissing(undefined, waitedStep, { ...ctx.getHookOpts(), cause: "timeout" });
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

    const waitTimeout = currentStep.waitForElement ?? ctx.getConfig("waitForElement") ?? 0;
    if (!hasWaitedForElement && waitTimeout > 0 && currentStep.element && !resolveElement(currentStep.element)) {
      const initialWait = ctx.getState("__initialWait");
      if (ctx.getState("activeStep")) {
        markStepPopoverWaiting(ctx);
      } else if (initialWait?.index === stepIndex) {
        markStepPopoverWaiting(ctx);
      } else {
        endInitialWait();
        showInitialWait(stepIndex);
      }

      waitForStepElement(currentStep, waitTimeout, found => {
        if (found) {
          drive(stepIndex, true);
        } else {
          handleWaitTimeout(stepIndex);
        }
      });
      return;
    }

    endInitialWait();

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

    const step = resolveStepAt(stepIndex);
    const activation = beginActivation(step);
    ctx.setState("__isWaiting", false);
    highlight(ctx, step);
    armActivation(activation);
  }

  function destroy(reason: DestroyReason, withOnDestroyStartedHook = true) {
    if (!ctx.getState("isInitialized")) {
      destroyEvents(ctx);
      destroyLiveRegion(ctx);
      ctx.setState("__events", undefined);
      ctx.setState("__teardownGate", undefined);
      ctx.setState("__liveRegion", undefined);
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
    destroyLiveRegion(ctx);
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
      const { __events, __teardownGate, __liveRegion } = ctx.getState();
      ctx.resetState();
      ctx.setState("__events", __events);
      ctx.setState("__teardownGate", __teardownGate);
      ctx.setState("__liveRegion", __liveRegion);
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
      cancelElementWait();
      endInitialWait();
      ctx.setState("__destroyReason", undefined);

      const highlightStep: DriveStep = {
        ...step,
        popover: step.popover
          ? {
              showButtons: [],
              showProgress: false,
              progressText: "",
              ...step.popover!,
            }
          : undefined,
      };
      const activation = beginActivation(highlightStep);
      ctx.setState("__isWaiting", false);
      highlight(ctx, highlightStep);
      armActivation(activation);
    },
    updatePopover,
    nudge: (target?: NudgeTarget) => nudge(ctx, target),
    destroy: () => {
      destroy("api", false);
    },
  };

  ctx.setDriver(api);

  return api;
}

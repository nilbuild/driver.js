import { AllowedButtons, destroyPopover } from "./popover/popover";
import { destroyOverlay } from "./overlay/overlay";
import { destroyEvents, initEvents, requireRefresh } from "./interaction/events";
import {
  beginActivation,
  cancelElementWait,
  endActivation,
  enterStep,
  isCurrent,
  isDone,
  isTransitioning,
  isWaiting,
  placeholderOf,
} from "./tour/lifecycle";
import { requestCompletion } from "./tour/completion";
import { Activation, Context, createContext } from "./core/context";
import { watchForRemoval } from "./tour/removal";
import type { AdvanceOn, Config, DestroyReason, Driver, DriveStep, PopoverPatch } from "./types";
import { endInitialWait, handleWaitTimeout, popoverTarget, showInitialWait, waitForStepElement } from "./tour/wait";
import { announce, destroyLiveRegion, mountLiveRegion } from "./popover/live-region";
import { listenForAdvanceEvents } from "./tour/advance";
import { advanceEvents, isClickGesture, resolveAdvanceOn, stepOption } from "./core/options";
import { nudge } from "./tour/nudge";

import { trackAllowedElements } from "./tour/allowed";
import { destroyHighlight, highlight } from "./tour/highlight";
import {
  findReachableIndex,
  isEndStep,
  resolveNextHook,
  resolvePrevHook,
  resolveStepButtons,
  isActionStep,
  isStandalone,
  markStandalone,
  markStepPopoverWaiting,
  popoverText,
  resolveTourStep,
  shouldSkipStep,
  updateStepPopover,
} from "./tour/step";
import { isDummyElement, resolveElement } from "./core/utils";
import "./styles/driver.css";

let teardownActive: (() => void) | undefined;

export type {
  AdvanceOn,
  AdvanceOnEvent,
  AdvanceOnOpts,
  AllowedElements,
  Config,
  DestroyReason,
  DriverHook,
  ElementMissing,
  ElementMissingHook,
  ElementMissingOpts,
  ElementMissingPreset,
  HookOpts,
  InteractionHook,
  InteractionOpts,
  InteractionRegion,
  PopoverPatch,
  Driver,
  DriveStep,
  Popover,
  State,
} from "./types";
export type { StageDefinition } from "./overlay/stage";
export type { PopoverDOM, Side, Alignment, AllowedButtons } from "./popover/popover";

export function driver(options: Config = {}): Driver {
  const ctx: Context = Object.assign(createContext(options), {
    tour: {
      drive,
      next,
      pressNext,
      previous,
      moveNext,
      movePrevious,
      close: () => destroy("close"),
      requestClose: handleClose,
      overlayClick: handleOverlayClick,
      escape: handleEscape,
      arrowLeft: handleArrowLeft,
      arrowRight: handleArrowRight,
      refreshPopover: refreshActivePopover,
    },
  });
  const teardown = () => destroy("replaced", false);

  function handleClose(reason: DestroyReason = "close") {
    if (!ctx.getConfig("allowClose")) {
      return;
    }

    destroy(reason);
  }

  function handleEscape() {
    if (currentButtons().disableButtons.includes("close")) {
      return;
    }

    handleClose("escape");
  }

  function currentPopoverStep(): DriveStep | undefined {
    return placeholderOf(ctx)?.step ?? ctx.getState("__activeStep");
  }

  function hookStep(): DriveStep | undefined {
    return currentPopoverStep() ?? ctx.getState("activeStep");
  }

  function currentButtons() {
    const step = currentPopoverStep();

    return resolveStepButtons(ctx, step);
  }

  function canSkipStep() {
    const step = ctx.getState("__activation")?.step ?? currentPopoverStep();

    return !isWaiting(ctx) && !isActionStep(step);
  }

  function nudgeIfGated(): boolean {
    const activation = ctx.getState("__activation");
    if (!isActionStep(activation?.step ?? currentPopoverStep())) {
      return false;
    }

    if (!(activation && isDone(ctx, activation.step)) && !isWaiting(ctx)) {
      nudge(ctx);
    }

    return true;
  }

  function pressNext() {
    if (!nudgeIfGated()) {
      next();
    }
  }

  function canUseButton(button: AllowedButtons) {
    if (button === "previous" && isWaiting(ctx)) {
      return false;
    }

    if (button === "next" && !canSkipStep()) {
      return false;
    }

    const { showButtons, disableButtons } = currentButtons();

    return showButtons.includes(button) && !disableButtons.includes(button);
  }

  function handleOverlayClick() {
    const overlayClickBehavior = ctx.getConfig("overlayClickBehavior");

    if (typeof overlayClickBehavior !== "function" && overlayClickBehavior !== "none" && nudgeIfGated()) {
      return;
    }

    if (ctx.getConfig("allowClose") && overlayClickBehavior === "close") {
      destroy("overlay");
      return;
    }

    if (typeof overlayClickBehavior === "function") {
      ctx.setState("__destroyReason", "overlay");

      const step = hookStep();
      if (step) {
        overlayClickBehavior(ctx.getState("__activeElement"), step, ctx.getHookOpts());
      }

      return;
    }

    if (overlayClickBehavior === "nextStep" && canSkipStep()) {
      next();
    }
  }

  function next() {
    const { element, step } = popoverTarget(ctx);
    const onNextClick = resolveNextHook(ctx, step);
    if (!step || !onNextClick) {
      moveUnlessStandalone(step, moveNext);
      return;
    }

    if (isEndStep(ctx, 1)) {
      ctx.setState("__destroyReason", "done");
    }

    onNextClick(element, step, ctx.getHookOpts());
  }

  function previous() {
    const { element, step } = popoverTarget(ctx);
    const onPrevClick = resolvePrevHook(ctx, step);
    if (!step || !onPrevClick) {
      moveUnlessStandalone(step, movePrevious);
      return;
    }

    onPrevClick(element, step, ctx.getHookOpts());
  }

  function moveUnlessStandalone(step: DriveStep | undefined, move: () => void) {
    if (!isStandalone(step)) {
      move();
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
    if (!steps[index]) {
      destroy("api");
      return;
    }

    init();
    drive(index);
  }

  function advance() {
    const activation = ctx.getState("__activation");
    if (!activation || isWaiting(ctx)) {
      return;
    }

    requestCompletion(ctx, activation);
  }

  const warnedSteps = new WeakSet<DriveStep>();

  function warnAboutDeadEnds(step: DriveStep, advanceOn: AdvanceOn | undefined) {
    const { types } = advanceEvents(advanceOn);
    const isBlocked = !!stepOption(ctx, step, "disableActiveInteraction");
    if (!isBlocked || !types.length || !types.every(isClickGesture)) {
      return;
    }

    const index = ctx.getState("activeIndex");
    const definition = (index !== undefined && ctx.getConfig("steps")?.[index]) || step;
    if (warnedSteps.has(definition)) {
      return;
    }
    warnedSteps.add(definition);

    const name = index === undefined ? "The highlight" : `Step ${index + 1}`;
    console.warn(`[driver.js] ${name} can't complete: disableActiveInteraction blocks its advanceOn events.`);
  }

  function armActivation(activation: Activation) {
    if (!isCurrent(ctx, activation)) {
      return;
    }

    const { step } = activation;
    trackAllowedElements(ctx, step, activation.controller.signal);
    watchForRemoval(ctx, activation);

    const advanceOn = resolveAdvanceOn(ctx, step);
    warnAboutDeadEnds(step, advanceOn);
    if (!advanceOn) {
      return;
    }

    listenForAdvanceEvents(ctx, advanceOn, activation, () => requestCompletion(ctx, activation));
  }

  function handleArrowLeft() {
    const activeIndex = ctx.getState("activeIndex");
    if (isTransitioning(ctx) || activeIndex === undefined || !ctx.getState("__activeStep")) {
      return;
    }

    const steps = ctx.getConfig("steps") || [];
    if (!steps[activeIndex - 1] || !canUseButton("previous")) {
      return;
    }

    previous();
  }

  function handleArrowRight() {
    const hasStep = ctx.getState("activeIndex") !== undefined && !!currentPopoverStep();
    if (isTransitioning(ctx) || !hasStep || nudgeIfGated() || !canUseButton("next")) {
      return;
    }

    next();
  }

  function updatePopover(patch?: PopoverPatch) {
    const activation = ctx.getState("__activation");
    if (!activation) {
      return;
    }

    activation.popoverPatch = patch ? { ...activation.popoverPatch, ...patch } : undefined;
    refreshActivePopover();
  }

  function setFeedback(feedback: string) {
    const activation = ctx.getState("__activation");
    if (!activation || (activation.feedback || "") === feedback) {
      return;
    }

    activation.feedback = feedback;
    refreshActivePopover();
    announce(ctx, ctx.getState("popover")?.feedback?.textContent || "");
  }

  function refreshActivePopover() {
    const activation = ctx.getState("__activation");
    if (!activation) {
      return;
    }

    const popover = ctx.getState("popover");
    const { element, step } = popoverTarget(ctx);
    if (!popover || !element || step !== activation.step) {
      return;
    }

    if (popover.wrapper.style.display === "none" || !popover.wrapper.isConnected) {
      return;
    }

    const before = popoverText(popover);
    updateStepPopover(ctx, element, activation.step);

    const changed = popoverText(popover).filter((text, index) => text && text !== before[index]);
    announce(ctx, changed.join(". "));
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
  }

  function drive(stepIndex: number = 0, hasWaitedForElement = false) {
    cancelElementWait(ctx);

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

    const waitTimeout = stepOption(ctx, currentStep, "waitForElement") ?? 0;
    if (!hasWaitedForElement && waitTimeout > 0 && currentStep.element && !resolveElement(currentStep.element)) {
      if (placeholderOf(ctx)?.index === stepIndex) {
        markStepPopoverWaiting(ctx, "initial");
      } else if (ctx.getState("activeStep")) {
        markStepPopoverWaiting(ctx, "next");
      } else {
        endInitialWait(ctx);
        showInitialWait(ctx, stepIndex);
      }

      waitForStepElement(ctx, currentStep, waitTimeout, found => {
        if (found) {
          drive(stepIndex, true);
        } else {
          handleWaitTimeout(ctx, stepIndex);
        }
      });
      return;
    }

    endInitialWait(ctx);

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

    enterStep(ctx, stepIndex, false);
    highlightStep(resolveTourStep(ctx, stepIndex));
  }

  function highlightStep(step: DriveStep) {
    const activation = beginActivation(ctx, step);
    highlight(ctx, step);
    armActivation(activation);
  }

  function removeTour() {
    if (teardownActive === teardown) {
      teardownActive = undefined;
    }

    document.body.classList.remove("driver-active", "driver-fade", "driver-simple", "driver-no-scroll");
    document.body.style.removeProperty("--driver-animation-duration");

    cancelElementWait(ctx);
    endActivation(ctx);
    destroyEvents(ctx);
    destroyLiveRegion(ctx);
    destroyPopover(ctx.getState("popover"));
    destroyHighlight(ctx);
    destroyOverlay(ctx);

    const state = ctx.getState();
    ctx.resetState();

    return state;
  }

  function destroy(reason: DestroyReason, withOnDestroyStartedHook = true) {
    if (!ctx.getState("isInitialized")) {
      return;
    }

    if (reason === "api") {
      reason = ctx.getState("__destroyReason") ?? "api";
    }

    const activeElement = ctx.getState("__activeElement");
    const activeStep = ctx.getState("__activeStep") ?? placeholderOf(ctx)?.step;
    const hookElement = isDummyElement(activeElement) ? undefined : activeElement;

    const activeOnDestroyed = ctx.getState("__activeOnDestroyed");

    const onDestroyStarted = ctx.getConfig("onDestroyStarted");
    const startedStep = hookStep();
    if (withOnDestroyStartedHook && onDestroyStarted && startedStep) {
      ctx.setState("__destroyReason", reason);
      onDestroyStarted(hookElement, startedStep, ctx.getHookOpts(undefined, reason));
      return;
    }

    const onDeselected = activeStep?.onDeselected || ctx.getConfig("onDeselected");
    const onDestroyed = ctx.getConfig("onDestroyed");
    const stateBeforeDestroy = removeTour();

    if (activeStep) {
      if (activeElement && onDeselected) {
        onDeselected(hookElement, activeStep, ctx.getHookOpts(stateBeforeDestroy, reason));
      }

      onDestroyed?.(hookElement, activeStep, ctx.getHookOpts(stateBeforeDestroy, reason));
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
      if (ctx.getState("isInitialized")) {
        removeTour();
      } else {
        ctx.resetState();
      }

      ctx.setConfig({
        ...ctx.getConfig(),
        steps,
      });
    },
    getConfig: ctx.getConfig,
    getState: ctx.getState,
    getActiveIndex: () => ctx.getState("activeIndex"),
    isFirstStep: () => isEndStep(ctx, -1),
    isLastStep: () => isEndStep(ctx, 1),
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
    hasNextStep: () => ctx.getState("activeIndex") !== undefined && !isEndStep(ctx, 1),
    hasPreviousStep: () => ctx.getState("activeIndex") !== undefined && !isEndStep(ctx, -1),
    highlight: (step: DriveStep) => {
      init();
      cancelElementWait(ctx);
      endInitialWait(ctx);
      ctx.setState("__destroyReason", undefined);

      highlightStep(
        markStandalone({
          ...step,
          popover: step.popover
            ? {
                showButtons: [],
                showProgress: false,
                progressText: "",
                ...step.popover,
              }
            : undefined,
        })
      );
    },
    updatePopover,
    advance,
    nudge: (message?: string | PopoverPatch) => {
      if (typeof message === "object") {
        updatePopover(message);
      }

      setFeedback(typeof message === "string" ? message : "");
      nudge(ctx);
    },
    destroy: () => {
      destroy("api", false);
    },
  };

  ctx.setDriver(api);
  return api;
}

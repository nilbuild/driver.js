import type { Renderer } from "./renderer";
import {
  beginActivation,
  cancelElementWait,
  endActivation,
  enterStep,
  isCurrent,
  isWaiting,
  placeholderOf,
  popoverStep,
} from "../tour/lifecycle";
import { requestCompletion } from "../tour/completion";
import { Activation, configure, Context, createContext, hookOpts, InternalState } from "./context";
import { watchForRemoval } from "../tour/removal";
import type { AdvanceOn, Config, DestroyReason, Driver, DriveStep, PopoverPatch } from "../types";
import { handleWaitTimeout, markWaiting, popoverTarget, reportWaiting, waitForStepElement } from "../tour/wait";
import { listenForAdvanceEvents } from "../tour/advance";
import { advanceEvents, isClickGesture, resolveAdvanceOn, stepOption } from "./options";
import {
  findReachableIndex,
  isEndStep,
  resolveNextHook,
  isStandalone,
  markStandalone,
  resolveTourStep,
  shouldSkipStep,
} from "../tour/step";
import { isDummyElement, resolveElement } from "./utils";

let teardownActive: (() => void) | undefined;

export function createEngine(options: Config, ui: Renderer): Driver {
  const ctx: Context = createContext(options, ui, {
    drive,
    next,
    moveNext,
    movePrevious,
    close: () => destroy("close"),
    destroy,
    refreshPopover: refreshActivePopover,
  });
  const teardown = () => destroy("replaced", false);

  function next() {
    const { element, step } = popoverTarget(ctx);
    const onNextClick = resolveNextHook(ctx, step);
    if (!step || !onNextClick) {
      if (!isStandalone(step)) {
        moveNext();
      }
      return;
    }

    if (isEndStep(ctx, 1)) {
      ctx.state.__destroyReason = "done";
    }

    onNextClick(element, step, hookOpts(ctx));
  }

  function moveNext() {
    const activeIndex = ctx.state.activeIndex;
    const steps = ctx.config.steps || [];
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
    const activeIndex = ctx.state.activeIndex;
    const steps = ctx.config.steps || [];
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
    const steps = ctx.config.steps || [];
    if (!steps[index]) {
      destroy("api");
      return;
    }

    init();
    drive(index);
  }

  function advance() {
    const activation = ctx.state.__activation;
    if (!activation || isWaiting(ctx)) {
      return;
    }

    requestCompletion(ctx, activation);
  }

  const warnedSteps = new WeakSet<DriveStep>();

  function warnAboutDeadEnds(step: DriveStep, advanceOn: AdvanceOn | undefined) {
    const { types } = advanceEvents(advanceOn);
    const isBlocked = ui.blocksInteraction && !!stepOption(ctx, step, "disableActiveInteraction");
    if (!isBlocked || !types.length || !types.every(isClickGesture)) {
      return;
    }

    const index = ctx.state.activeIndex;
    const definition = (index !== undefined && ctx.config.steps?.[index]) || step;
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
    ui.trackAllowed(ctx, step, activation.controller.signal);
    watchForRemoval(ctx, activation);

    const advanceOn = resolveAdvanceOn(ctx, step);
    warnAboutDeadEnds(step, advanceOn);
    if (!advanceOn) {
      return;
    }

    listenForAdvanceEvents(ctx, advanceOn, activation, () => requestCompletion(ctx, activation));
  }

  function updatePopover(patch?: PopoverPatch) {
    const activation = ctx.state.__activation;
    if (!activation) {
      return;
    }

    activation.popoverPatch = patch ? { ...activation.popoverPatch, ...patch } : undefined;
    refreshActivePopover();
  }

  function setFeedback(feedback: string) {
    const activation = ctx.state.__activation;
    if (!activation || (activation.feedback || "") === feedback) {
      return;
    }

    activation.feedback = feedback;
    refreshActivePopover();
    ui.announce(ctx, ctx.state.popover?.feedback?.textContent || "");
  }

  function refreshActivePopover() {
    ui.refreshPopover(ctx);
  }

  function init() {
    if (ctx.state.isInitialized) {
      return;
    }

    if (teardownActive && teardownActive !== teardown) {
      teardownActive();
    }
    teardownActive = teardown;

    ctx.state.isInitialized = true;
    ui.mount(ctx);
  }

  function drive(stepIndex: number = 0, hasWaitedForElement = false) {
    cancelElementWait(ctx);

    ctx.state.__destroyReason = undefined;

    const steps = ctx.config.steps;
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
        markWaiting(ctx, "initial");
      } else if (ctx.state.activeStep) {
        markWaiting(ctx, "next");
      } else {
        ui.endInitialWait(ctx);
        ui.showInitialWait(ctx, stepIndex);
      }

      waitForStepElement(ctx, currentStep, waitTimeout, found => {
        if (found) {
          drive(stepIndex, true);
        } else {
          handleWaitTimeout(ctx, stepIndex);
        }
      });
      reportWaiting(ctx, resolveTourStep(ctx, stepIndex), stepIndex);
      return;
    }

    ui.endInitialWait(ctx);

    if (shouldSkipStep(ctx, currentStep)) {
      const activeIndex = ctx.state.activeIndex;
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
    ui.highlight(ctx, step);
    armActivation(activation);
  }

  function removeTour() {
    if (teardownActive === teardown) {
      teardownActive = undefined;
    }

    ui.detach(ctx);
    cancelElementWait(ctx);
    endActivation(ctx);
    ui.unmount(ctx);

    const state = ctx.state;
    ctx.state = {};

    return state;
  }

  function destroy(reason: DestroyReason, withOnDestroyStartedHook = true) {
    if (!ctx.state.isInitialized) {
      return;
    }

    if (reason === "api") {
      reason = ctx.state.__destroyReason ?? "api";
    }

    const hasHighlighted = !!ctx.state.__activeElement || !!ctx.state.__activeStep;
    // closed while the first step was still moving in: its element and step aren't committed yet
    const activeElement = hasHighlighted ? ctx.state.__activeElement : ctx.state.activeElement;
    const activeStep =
      ctx.state.__activeStep ?? placeholderOf(ctx)?.step ?? ctx.state.activeStep ?? ctx.state.__activation?.step;
    const hookElement = isDummyElement(activeElement) ? undefined : activeElement;

    // the keyboard goes back where it was only if the tour still has it (the user may have moved on into the page)
    const focused = document.activeElement;
    const hasFocus = !focused || focused === document.body || !!ctx.state.popover?.wrapper.contains(focused);
    const activeOnDestroyed = hasFocus ? ctx.state.__activeOnDestroyed : undefined;

    const onDestroyStarted = ctx.config.onDestroyStarted;
    const startedStep = popoverStep(ctx) ?? ctx.state.activeStep ?? ctx.state.__activation?.step;
    if (withOnDestroyStartedHook && onDestroyStarted && startedStep) {
      ctx.state.__destroyReason = reason;
      onDestroyStarted(hookElement, startedStep, hookOpts(ctx, undefined, reason));
      return;
    }

    const onDeselected = activeStep?.onDeselected || ctx.config.onDeselected;
    const onDestroyed = ctx.config.onDestroyed;
    const stateBeforeDestroy = removeTour();

    if (activeStep) {
      if (hasHighlighted && onDeselected) {
        onDeselected(hookElement, activeStep, hookOpts(ctx, stateBeforeDestroy, reason));
      }

      onDestroyed?.(hookElement, activeStep, hookOpts(ctx, stateBeforeDestroy, reason));
    }

    if (activeOnDestroyed) {
      ui.restoreFocus(activeOnDestroyed);
    }
  }

  const api: Driver = {
    isActive: () => ctx.state.isInitialized || false,
    refresh: () => ui.refresh(ctx),
    drive: (stepIndex: number = 0) => {
      init();
      drive(stepIndex);
    },
    setConfig: config => configure(ctx, config),
    setSteps: (steps: DriveStep[]) => {
      if (ctx.state.isInitialized) {
        removeTour();
      } else {
        ctx.state = {};
      }

      configure(ctx, { ...ctx.config, steps });
    },
    getConfig: ((key?: keyof Config) => (key ? ctx.config[key] : ctx.config)) as Driver["getConfig"],
    getState: (key?: string) => (key ? ctx.state[key as keyof InternalState] : ctx.state),
    getActiveIndex: () => ctx.state.activeIndex,
    isFirstStep: () => isEndStep(ctx, -1),
    isLastStep: () => isEndStep(ctx, 1),
    getActiveStep: () => ctx.state.activeStep,
    getActiveElement: () => ctx.state.activeElement,
    getPreviousElement: () => ctx.state.previousElement,
    getPreviousStep: () => ctx.state.previousStep,
    getNextStep: () => {
      const steps = ctx.config.steps || [];
      const activeIndex = ctx.state.activeIndex;
      if (activeIndex === undefined) {
        return undefined;
      }

      const nextIndex = findReachableIndex(ctx, activeIndex + 1, 1);

      return nextIndex !== undefined ? steps[nextIndex] : undefined;
    },
    moveNext,
    movePrevious,
    moveTo,
    hasNextStep: () => ctx.state.activeIndex !== undefined && !isEndStep(ctx, 1),
    hasPreviousStep: () => ctx.state.activeIndex !== undefined && !isEndStep(ctx, -1),
    highlight: (step: DriveStep) => {
      init();
      cancelElementWait(ctx);
      ui.endInitialWait(ctx);
      ctx.state.__destroyReason = undefined;

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
      ui.nudge(ctx);
    },
    destroy: () => {
      destroy("api", false);
    },
  };

  ctx.driver = api;
  return api;
}

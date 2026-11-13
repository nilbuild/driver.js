import { hookOpts } from "../core/context";
import type { Context, DriverHook } from "../core/context";
import type { DriveStep, Popover } from "../types";
import {
  AllowedButtons,
  destroyPopover,
  PopoverDOM,
  PopoverRenderOptions,
  renderPopover,
  toggleButton,
  updatePopoverContent,
} from "../popover/popover";
import { PositionOptions, repositionPopover } from "../popover/position";
import { isDummyElement, resolveElement } from "../core/utils";
import { isFocusWithinStep } from "./allowed";
import { announce } from "../popover/live-region";
import { stepOption } from "../core/options";
import { isDone, isWaiting } from "./lifecycle";

const DEFAULT_PROGRESS_TEXT = "{{current}} of {{total}}";

export function shouldSkipStep(ctx: Context, step: DriveStep): boolean {
  const skip = stepOption(ctx, step, "skipMissingElement");
  if (!skip || !step.element) {
    return false;
  }

  return !resolveElement(step.element);
}

export function findReachableIndex(ctx: Context, fromIndex: number, direction: 1 | -1): number | undefined {
  const steps = ctx.config.steps || [];

  for (let i = fromIndex; i >= 0 && i < steps.length; i += direction) {
    if (!shouldSkipStep(ctx, steps[i])) {
      return i;
    }
  }

  return undefined;
}

export function isEndStep(ctx: Context, direction: 1 | -1): boolean {
  const activeIndex = ctx.state.activeIndex;

  return activeIndex !== undefined && findReachableIndex(ctx, activeIndex + direction, direction) === undefined;
}

export function resolveNextHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  const isLastStep = isEndStep(ctx, 1);
  const onDoneClick = step?.popover?.onDoneClick || ctx.config.onDoneClick;
  if (isLastStep && onDoneClick) {
    return onDoneClick;
  }

  return step?.popover?.onNextClick || ctx.config.onNextClick;
}

export function resolvePrevHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  return step?.popover?.onPrevClick || ctx.config.onPrevClick;
}

export function resolveCloseHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  return step?.popover?.onCloseClick || ctx.config.onCloseClick;
}

function formatProgress(ctx: Context, text: string, stepIndex: number): string {
  const total = (ctx.config.steps || []).length;

  return text.replace("{{current}}", `${stepIndex + 1}`).replace("{{total}}", `${total}`);
}

const TOUR_BUTTONS: AllowedButtons[] = ["next", "previous", "close"];

type TourPlace = {
  index: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

function placeOf(ctx: Context, stepIndex: number): TourPlace {
  return {
    index: stepIndex,
    hasNext: findReachableIndex(ctx, stepIndex + 1, 1) !== undefined,
    hasPrevious: findReachableIndex(ctx, stepIndex - 1, -1) !== undefined,
  };
}

export function resolvePopoverOptions(ctx: Context, popover: Popover = {}, place?: TourPlace) {
  const config = ctx.config;
  const configuredButtons = popover.showButtons || config.showButtons;
  const progressText = config.progressText || DEFAULT_PROGRESS_TEXT;

  const shared = {
    showProgress: popover.showProgress ?? config.showProgress ?? false,
    prevBtnText: popover.prevBtnText ?? (config.prevBtnText || "Previous"),
    closeBtnLabel: popover.closeBtnLabel ?? (config.closeBtnLabel || "Close"),
    popoverClass: popover.popoverClass || config.popoverClass || "",
  };

  if (!place) {
    return {
      ...shared,
      showButtons: configuredButtons || [],
      disableButtons: popover.disableButtons || config.disableButtons || [],
      progressText: popover.progressText ?? progressText,
      nextBtnText: popover.nextBtnText ?? (config.nextBtnText || "Next"),
    };
  }

  return {
    ...shared,
    showButtons: TOUR_BUTTONS.filter(button => {
      const isAllowed = button !== "close" || config.allowClose;

      return isAllowed && (!configuredButtons || configuredButtons.includes(button));
    }),
    disableButtons: [...(config.disableButtons || []), ...(place.hasPrevious ? [] : ["previous" as AllowedButtons])],
    progressText: formatProgress(ctx, popover.progressText || progressText, place.index),
    nextBtnText: place.hasNext
      ? (popover.nextBtnText ?? (config.nextBtnText || "Next"))
      : popover.doneBtnText || config.doneBtnText || "Done",
  };
}

export function resolveTourStep(ctx: Context, stepIndex: number): DriveStep {
  const steps = ctx.config.steps || [];
  const step = steps[stepIndex];
  const popover = step.popover || {};
  const place = placeOf(ctx, stepIndex);
  const resolved = resolvePopoverOptions(ctx, popover, place);

  return {
    ...step,
    popover: {
      showButtons: resolved.showButtons,
      nextBtnText: place.hasNext ? undefined : resolved.nextBtnText,
      disableButtons: resolved.disableButtons,
      showProgress: resolved.showProgress,
      onNextClick: popover.onNextClick || ctx.config.onNextClick || ctx.tour.moveNext,
      onPrevClick: resolvePrevHook(ctx, step) || ctx.tour.movePrevious,
      onCloseClick: resolveCloseHook(ctx, step) || ctx.tour.close,
      ...popover,
      progressText: resolved.progressText,
    },
  };
}

export function isActionStep(step?: DriveStep): boolean {
  return !!step?.popover?.instruction && !isStandalone(step);
}

const standaloneSteps = new WeakSet<DriveStep>();

export function isStandalone(step?: DriveStep): boolean {
  return !!step && standaloneSteps.has(step);
}

export function markStandalone(step: DriveStep): DriveStep {
  standaloneSteps.add(step);

  return step;
}

function resolveStepPosition(ctx: Context, element: Element, step: DriveStep): PositionOptions {
  const stagePadding = ctx.config.stagePadding || 0;

  return {
    side: step.popover?.side || "bottom",
    align: step.popover?.align || "start",
    offset: stagePadding + (ctx.config.popoverOffset || 0),
    padding: stagePadding,
    centered: isDummyElement(element),
  };
}

function activePatch(ctx: Context, step: DriveStep) {
  const activation = ctx.state.__activation;

  return activation?.popoverPatch && activation.step === step ? activation.popoverPatch : undefined;
}

function currentPopover(ctx: Context, step: DriveStep) {
  const patch = activePatch(ctx, step);
  const popover: Popover = { ...step.popover, ...patch };
  const options = resolvePopoverOptions(ctx, popover);

  if (patch?.popoverClass !== undefined) {
    options.popoverClass = patch.popoverClass;
  }

  if (patch?.progressText !== undefined) {
    options.progressText = formatProgress(ctx, patch.progressText, ctx.state.activeIndex ?? 0);
  }

  return { popover, options };
}

export function resolveStepButtons(ctx: Context, step?: DriveStep) {
  const { showButtons, disableButtons } = step ? currentPopover(ctx, step).options : resolvePopoverOptions(ctx);

  return { showButtons, disableButtons };
}

function resolveStepPopover(ctx: Context, element: Element, step: DriveStep): PopoverRenderOptions {
  const { popover, options } = currentPopover(ctx, step);

  const activation = ctx.state.__activation;
  const isGated = isActionStep(step);

  return {
    ...options,
    title: popover.title,
    description: popover.description,

    isGated,
    isDone: isGated && isDone(ctx, step),
    instruction: isGated || isStandalone(step) ? popover.instruction : undefined,
    feedback: activation?.step === step ? activation.feedback : undefined,

    doneButton: isEndStep(ctx, 1),
    smoothScroll: ctx.config.smoothScroll,
    scrollIntoView: stepOption(ctx, step, "scrollIntoView"),

    onNextClick: ctx.tour.pressNext,
    onPrevClick: ctx.tour.previous,

    onCloseClick: () => {
      ctx.state.__destroyReason = "close";

      const onCloseClick = resolveCloseHook(ctx, step);
      if (onCloseClick) {
        return onCloseClick(ctx.state.activeElement ?? element, step, hookOpts(ctx));
      }

      return ctx.tour.requestClose();
    },

    onRender: popoverDom => {
      ctx.state.popover = popoverDom;

      const onPopoverRender = popover.onPopoverRender || ctx.config.onPopoverRender;
      onPopoverRender?.(popoverDom, hookOpts(ctx));
    },

    position: resolveStepPosition(ctx, element, step),
  };
}

export function renderStepPopover(ctx: Context, element: Element, step: DriveStep) {
  destroyPopover(ctx.state.popover);

  const keepFocus = isFocusWithinStep(ctx, element, step);
  const popover = renderPopover(element, {
    ...resolveStepPopover(ctx, element, step),
    keepFocus,
  });

  showStepPopoverState(ctx);

  if (keepFocus) {
    announce(ctx, popoverText(popover).filter(Boolean).join(". "));
  }
}

export function popoverText(popover: PopoverDOM): string[] {
  return [popover.title, popover.description, popover.instruction].map(part =>
    !part || part.style.display === "none" ? "" : part.textContent || ""
  );
}

export function showStepPopoverState(ctx: Context) {
  if (isWaiting(ctx)) {
    showPopoverWaiting(ctx);
  }
}

export function updateStepPopover(ctx: Context, element: Element, step: DriveStep) {
  const popover = ctx.state.popover;
  if (!popover) {
    return;
  }

  updatePopoverContent(popover, element, resolveStepPopover(ctx, element, step));
  showStepPopoverState(ctx);
}

export function repositionStepPopover(ctx: Context, element: Element, step: DriveStep) {
  const popover = ctx.state.popover;
  if (!popover) {
    return;
  }

  repositionPopover(popover, element, resolveStepPosition(ctx, element, step));
}

export function showPopoverWaiting(ctx: Context) {
  const popover = ctx.state.popover;
  if (!popover || popover.wrapper.style.display === "none") {
    return;
  }

  popover.wrapper.classList.add("driver-popover-waiting");
  popover.wrapper.setAttribute("aria-busy", "true");
  toggleButton(popover.nextButton, true);
  toggleButton(popover.previousButton, true);
}

export function hidePopoverWaiting(ctx: Context, element: Element | undefined, step: DriveStep | undefined) {
  const popover = ctx.state.popover;
  if (!popover || popover.wrapper.style.display === "none") {
    return;
  }

  popover.wrapper.classList.remove("driver-popover-waiting");
  popover.wrapper.removeAttribute("aria-busy");
  if (element && step) {
    updateStepPopover(ctx, element, step);
  }
}

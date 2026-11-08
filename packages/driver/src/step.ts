import type { Context, DriverHook } from "./context";
import type { DriveStep } from "./driver";
import { AllowedButtons, destroyPopover, PopoverRenderOptions, renderPopover, updatePopoverContent } from "./popover";
import { PositionOptions, repositionPopover } from "./position";
import { resolveElement } from "./utils";
import { isFocusWithinStep } from "./allowed";
import { announce } from "./live-region";

// Bridges the tour and the popover primitive: a step's popover resolves here
// against the instance config (step value first, then the global default, then
// the built-in fallback). The primitive itself never reads config or state.

const DEFAULT_PROGRESS_TEXT = "{{current}} of {{total}}";

export function shouldSkipStep(ctx: Context, step: DriveStep): boolean {
  const skip = step.skipMissingElement ?? ctx.getConfig("skipMissingElement");
  if (!skip || !step.element) {
    return false;
  }

  return !resolveElement(step.element);
}

// The index navigation would actually land on, starting at fromIndex
// (inclusive) and walking in the given direction past any skipped steps.
// Resolved against the live DOM, so the answer can change as elements mount
// and unmount; every first/last-step decision goes through here so the done
// button and the tour's real end always agree (#616).
export function findReachableIndex(ctx: Context, fromIndex: number, direction: 1 | -1): number | undefined {
  const steps = ctx.getConfig("steps") || [];

  for (let i = fromIndex; i >= 0 && i < steps.length; i += direction) {
    if (!shouldSkipStep(ctx, steps[i])) {
      return i;
    }
  }

  return undefined;
}

// On the final step the next button acts as the done button, so a dedicated
// onDoneClick takes precedence over onNextClick when provided.
export function resolveNextHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  const activeIndex = ctx.getState("activeIndex");
  const isLastStep = activeIndex !== undefined && findReachableIndex(ctx, activeIndex + 1, 1) === undefined;

  const onDoneClick = step?.popover?.onDoneClick || ctx.getConfig("onDoneClick");
  if (isLastStep && onDoneClick) {
    return onDoneClick;
  }

  return step?.popover?.onNextClick || ctx.getConfig("onNextClick");
}

export function resolvePrevHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  return step?.popover?.onPrevClick || ctx.getConfig("onPrevClick");
}

export function resolveCloseHook(ctx: Context, step?: DriveStep): DriverHook | undefined {
  return step?.popover?.onCloseClick || ctx.getConfig("onCloseClick");
}

// Default button actions passed in by the tour, which alone knows how to
// navigate and destroy; a hook from the step or the config wins over them.
export type TourStepDefaults = {
  onNextClick: DriverHook;
  onPrevClick: DriverHook;
  onCloseClick: DriverHook;
};

// The resolved step is what ends up in state and what the lifecycle hooks
// receive, not just what gets rendered.
export function resolveTourStep(ctx: Context, stepIndex: number, defaults: TourStepDefaults): DriveStep {
  const steps = ctx.getConfig("steps") || [];
  const step = steps[stepIndex];
  const popover = step.popover || {};

  const hasNextStep = findReachableIndex(ctx, stepIndex + 1, 1) !== undefined;
  const hasPreviousStep = findReachableIndex(ctx, stepIndex - 1, -1) !== undefined;

  const doneBtnText = popover.doneBtnText || ctx.getConfig("doneBtnText") || "Done";
  const allowsClosing = ctx.getConfig("allowClose");
  const showProgress =
    typeof popover.showProgress !== "undefined" ? popover.showProgress : ctx.getConfig("showProgress");
  const progressText = popover.progressText || ctx.getConfig("progressText") || DEFAULT_PROGRESS_TEXT;
  const progressTextReplaced = progressText
    .replace("{{current}}", `${stepIndex + 1}`)
    .replace("{{total}}", `${steps.length}`);

  const configuredButtons = popover.showButtons || ctx.getConfig("showButtons");
  const calculatedButtons: AllowedButtons[] = [
    "next",
    "previous",
    ...(allowsClosing ? ["close" as AllowedButtons] : []),
  ].filter(b => {
    return !configuredButtons || configuredButtons.includes(b as AllowedButtons);
  }) as AllowedButtons[];

  const onNextClick = popover.onNextClick || ctx.getConfig("onNextClick");
  const onPrevClick = popover.onPrevClick || ctx.getConfig("onPrevClick");
  const onCloseClick = popover.onCloseClick || ctx.getConfig("onCloseClick");

  return {
    ...step,
    popover: {
      showButtons: calculatedButtons,
      nextBtnText: !hasNextStep ? doneBtnText : undefined,
      disableButtons: [
        ...(ctx.getConfig("disableButtons") || []),
        ...(!hasPreviousStep ? ["previous" as AllowedButtons] : []),
      ],
      showProgress,
      onNextClick: onNextClick ? onNextClick : defaults.onNextClick,
      onPrevClick: onPrevClick ? onPrevClick : defaults.onPrevClick,
      onCloseClick: onCloseClick ? onCloseClick : defaults.onCloseClick,
      ...popover,
      progressText: progressTextReplaced,
    },
  };
}

export function resolveStepButtons(ctx: Context, step?: DriveStep) {
  return {
    showButtons: step?.popover?.showButtons || ctx.getConfig("showButtons") || [],
    disableButtons: step?.popover?.disableButtons || ctx.getConfig("disableButtons") || [],
  };
}

export function isPopoverWaiting(ctx: Context): boolean {
  return !!ctx.getState("__isWaiting") || !!ctx.getState("popover")?.wrapper.classList.contains("driver-popover-waiting");
}

function resolveStepPosition(ctx: Context, element: Element, step: DriveStep): PositionOptions {
  const stagePadding = ctx.getConfig("stagePadding") || 0;

  return {
    side: step.popover?.side || "bottom",
    align: step.popover?.align || "start",
    // The popover clears the highlight cutout (stagePadding) plus the
    // configured gap between the two.
    offset: stagePadding + (ctx.getConfig("popoverOffset") || 0),
    padding: stagePadding,
    // Without a real element the tour highlights a dummy element at the center
    // of the screen, and the popover is centered over it like a modal.
    centered: element.id === "driver-dummy-element",
  };
}

function resolveStepPopover(ctx: Context, element: Element, step: DriveStep): PopoverRenderOptions {
  const popover = step.popover || {};

  const activeIndex = ctx.getState("activeIndex");
  const isDoneStep = activeIndex !== undefined && findReachableIndex(ctx, activeIndex + 1, 1) === undefined;

  return {
    title: popover.title,
    description: popover.description,

    ...resolveStepButtons(ctx, step),
    showProgress: popover.showProgress || ctx.getConfig("showProgress") || false,

    progressText: popover.progressText ?? (ctx.getConfig("progressText") || DEFAULT_PROGRESS_TEXT),
    nextBtnText: popover.nextBtnText ?? (ctx.getConfig("nextBtnText") || "Next"),
    prevBtnText: popover.prevBtnText ?? (ctx.getConfig("prevBtnText") || "Previous"),
    closeBtnLabel: popover.closeBtnLabel ?? (ctx.getConfig("closeBtnLabel") || "Close"),

    doneButton: isDoneStep,

    popoverClass: popover.popoverClass || ctx.getConfig("popoverClass") || "",
    smoothScroll: ctx.getConfig("smoothScroll"),

    // The hooks are resolved when the button is clicked rather than up front,
    // so a setConfig() between render and click is still picked up.
    onNextClick: () => {
      if (isDoneStep) {
        ctx.setState("__destroyReason", "done");
      }

      const onNextClick = resolveNextHook(ctx, step);
      if (onNextClick) {
        return onNextClick(ctx.getState("activeElement") ?? element, step, ctx.getHookOpts());
      }

      return ctx.emit("nextClick");
    },

    onPrevClick: () => {
      const onPrevClick = resolvePrevHook(ctx, step);
      if (onPrevClick) {
        return onPrevClick(ctx.getState("activeElement") ?? element, step, ctx.getHookOpts());
      }

      return ctx.emit("prevClick");
    },

    onCloseClick: () => {
      ctx.setState("__destroyReason", "close");

      const onCloseClick = resolveCloseHook(ctx, step);
      if (onCloseClick) {
        return onCloseClick(ctx.getState("activeElement") ?? element, step, ctx.getHookOpts());
      }

      return ctx.emit("closeClick");
    },

    onRender: popoverDom => {
      // Commit the popover to state before the user hook runs; the hook's
      // opts.state.popover has always pointed at the freshly rendered popover.
      ctx.setState("popover", popoverDom);

      const onPopoverRender = popover.onPopoverRender || ctx.getConfig("onPopoverRender");
      onPopoverRender?.(popoverDom, ctx.getHookOpts());
    },

    position: resolveStepPosition(ctx, element, step),
  };
}

function activePatch(ctx: Context, step: DriveStep) {
  const activation = ctx.getState("__activation");

  return activation?.popoverPatch && activation.step === step ? activation.popoverPatch : undefined;
}

export function withPopoverPatch(ctx: Context, step: DriveStep): DriveStep {
  const patch = activePatch(ctx, step);
  if (!patch) {
    return step;
  }

  return { ...step, popover: { ...step.popover, ...patch } };
}

function resolvePatchedPopover(ctx: Context, element: Element, step: DriveStep): PopoverRenderOptions {
  const options = resolveStepPopover(ctx, element, withPopoverPatch(ctx, step));
  const patch = activePatch(ctx, step);
  if (!patch) {
    return options;
  }

  if (patch.showProgress !== undefined) {
    options.showProgress = patch.showProgress;
  }

  if (patch.popoverClass !== undefined) {
    options.popoverClass = patch.popoverClass;
  }

  if (patch.progressText !== undefined) {
    const steps = ctx.getConfig("steps") || [];
    const activeIndex = ctx.getState("activeIndex") ?? 0;
    options.progressText = patch.progressText
      .replace("{{current}}", `${activeIndex + 1}`)
      .replace("{{total}}", `${steps.length}`);
  }

  return options;
}

export function renderStepPopover(ctx: Context, element: Element, step: DriveStep) {
  destroyPopover(ctx.getState("popover"));

  const keepFocus = isFocusWithinStep(ctx, element, step);
  const popover = renderPopover(element, {
    ...resolvePatchedPopover(ctx, element, step),
    keepFocus,
  });

  if (ctx.getState("__isWaiting")) {
    markStepPopoverWaiting(ctx);
  }

  if (keepFocus) {
    const text = [popover.title, popover.description]
      .filter(part => part.style.display !== "none")
      .map(part => part.textContent || "");
    announce(ctx, text.filter(Boolean).join(". "));
  }
}

export function updateStepPopover(ctx: Context, element: Element, step: DriveStep) {
  const popover = ctx.getState("popover");
  if (!popover) {
    return;
  }

  updatePopoverContent(popover, element, resolvePatchedPopover(ctx, element, step));
}

export function repositionStepPopover(ctx: Context, element: Element, step: DriveStep) {
  const popover = ctx.getState("popover");
  if (!popover) {
    return;
  }

  repositionPopover(popover, element, resolveStepPosition(ctx, element, step));
}

export function markStepPopoverWaiting(ctx: Context) {
  ctx.setState("__isWaiting", true);

  const popover = ctx.getState("popover");
  if (!popover || popover.wrapper.style.display === "none") {
    return;
  }

  popover.wrapper.classList.add("driver-popover-waiting");
  popover.wrapper.setAttribute("aria-busy", "true");
  for (const button of [popover.nextButton, popover.previousButton]) {
    button.disabled = true;
    button.classList.add("driver-popover-btn-disabled");
  }
}

export function clearStepPopoverWaiting(ctx: Context, element: Element | undefined, step: DriveStep | undefined) {
  ctx.setState("__isWaiting", false);

  const popover = ctx.getState("popover");
  if (!popover || !popover.wrapper.classList.contains("driver-popover-waiting")) {
    return;
  }

  popover.wrapper.classList.remove("driver-popover-waiting");
  popover.wrapper.removeAttribute("aria-busy");
  if (element && step) {
    updateStepPopover(ctx, element, step);
  }
}

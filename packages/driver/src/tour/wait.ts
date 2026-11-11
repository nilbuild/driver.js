import {
  beginActivation,
  dropPlaceholder,
  enterStep,
  hasElementWait,
  isCurrent,
  placeholderOf,
  setElementWait,
  unlatch,
} from "./lifecycle";
import type { Context } from "../core/context";
import { mountDummyElement, removeDummyElement } from "./highlight";
import { destroyPopover } from "../popover/popover";
import { resolveMissing } from "./removal";
import { clearStepPopoverWaiting, markStepPopoverWaiting, renderStepPopover, resolveTourStep } from "./step";
import type { DriveStep } from "../types";
import { resolveElement } from "../core/utils";

export function popoverTarget(ctx: Context) {
  const placeholder = placeholderOf(ctx);

  return {
    element: placeholder?.element ?? ctx.getState("activeElement"),
    step: placeholder?.step ?? ctx.getState("activeStep"),
  };
}

export function clearWaiting(ctx: Context) {
  const target = popoverTarget(ctx);
  clearStepPopoverWaiting(ctx, target.element, target.step);
}

export function waitForStepElement(
  ctx: Context,
  step: DriveStep,
  timeout: number,
  onSettled: (found: boolean) => void
) {
  const originating = ctx.getState("__activation");

  const settle = (found: boolean) => {
    observer.disconnect();
    window.clearTimeout(timer);
    setElementWait(ctx);
    onSettled(found);

    if (originating) {
      unlatch(ctx, originating);
    }
  };

  const observer = new MutationObserver(() => {
    if (resolveElement(step.element)) {
      settle(true);
    }
  });

  const timer = window.setTimeout(() => settle(false), timeout);

  setElementWait(ctx, () => {
    observer.disconnect();
    window.clearTimeout(timer);
  });

  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

export function showInitialWait(ctx: Context, stepIndex: number) {
  const step = resolveTourStep(ctx, stepIndex);
  if (!step.popover) {
    return;
  }

  const element = mountDummyElement();
  enterStep(ctx, stepIndex, true);
  beginActivation(ctx, step, { element, index: stepIndex });
  renderStepPopover(ctx, element, step);
  markStepPopoverWaiting(ctx, "initial");
}

export function endInitialWait(ctx: Context) {
  if (!dropPlaceholder(ctx)) {
    return;
  }

  destroyPopover(ctx.getState("popover"));
  ctx.setState("popover", undefined);
  removeDummyElement();
}

export function handleWaitTimeout(ctx: Context, stepIndex: number) {
  const waitedStep = resolveTourStep(ctx, stepIndex);
  const missing = resolveMissing(ctx, waitedStep);
  const hasCurrentStep = !!ctx.getState("activeStep");
  if (missing === "stay" || (typeof missing === "string" && !hasCurrentStep)) {
    ctx.tour.drive(stepIndex, true);
    return;
  }

  const activation = ctx.getState("__activation");
  clearWaiting(ctx);
  if (typeof missing === "string") {
    return;
  }

  const result = missing(undefined, waitedStep, {
    ...ctx.getHookOpts(),
    index: stepIndex,
    cause: "timeout",
  });
  const hasMoved = !ctx.getState("isInitialized") || !isCurrent(ctx, activation) || hasElementWait(ctx);
  if (result === false || hasMoved) {
    return;
  }

  ctx.tour.drive(stepIndex, true);
}

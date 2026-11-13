import { clearWait, hasElementWait, isCurrent, placeholderOf, setElementWait, setWait, unlatch } from "./lifecycle";
import { hookOpts } from "../core/context";
import type { Context, StepWait } from "../core/context";
import { resolveMissing } from "./removal";
import { resolveTourStep } from "./step";
import type { DriveStep } from "../types";
import { isEndless, resolveElement } from "../core/utils";
import { stepOption } from "../core/options";

export function popoverTarget(ctx: Context) {
  const placeholder = placeholderOf(ctx);

  return {
    element: placeholder?.element ?? ctx.state.activeElement,
    step: placeholder?.step ?? ctx.state.activeStep,
  };
}

export function markWaiting(ctx: Context, wait: StepWait) {
  setWait(ctx, wait);
  ctx.ui.showWaiting(ctx);
}

export function reportWaiting(ctx: Context, step: DriveStep, index: number | undefined, element?: Element) {
  const activation = ctx.state.__activation;
  const onWaitingForElement = stepOption(ctx, step, "onWaitingForElement");
  if (!onWaitingForElement || !activation?.wait) {
    return;
  }

  activation.waitController?.abort();
  const controller = new AbortController();
  activation.waitController = controller;

  onWaitingForElement(element, step, {
    ...hookOpts(ctx),
    index,
    signal: controller.signal,
  });
}

export function clearWaiting(ctx: Context) {
  const target = popoverTarget(ctx);
  if (!clearWait(ctx)) {
    return;
  }

  ctx.ui.hideWaiting(ctx, target.element, target.step);
}

export function waitForStepElement(
  ctx: Context,
  step: DriveStep,
  timeout: number,
  onSettled: (found: boolean) => void
) {
  const originating = ctx.state.__activation;
  let frame: number | undefined;

  const stop = () => {
    observer.disconnect();
    window.clearTimeout(timer);
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
    }
  };

  const settle = (found: boolean) => {
    stop();
    setElementWait(ctx);
    onSettled(found);

    if (originating) {
      unlatch(ctx, originating);
    }
  };

  const check = () => {
    frame = undefined;
    if (resolveElement(step.element)) {
      settle(true);
    }
  };

  const observer = new MutationObserver(() => {
    frame ??= window.requestAnimationFrame(check);
  });

  const timer = isEndless(timeout) ? undefined : window.setTimeout(() => settle(false), timeout);

  setElementWait(ctx, stop);

  observer.observe(document.documentElement, { childList: true, subtree: true, attributes: true });
}

export function handleWaitTimeout(ctx: Context, stepIndex: number) {
  const waitedStep = resolveTourStep(ctx, stepIndex);
  const missing = resolveMissing(ctx, waitedStep);
  const hasCurrentStep = !!ctx.state.activeStep;
  if (missing === "stay" || (typeof missing === "string" && !hasCurrentStep)) {
    ctx.tour.drive(stepIndex, true);
    return;
  }

  const activation = ctx.state.__activation;
  clearWaiting(ctx);
  if (typeof missing === "string") {
    return;
  }

  const result = missing(undefined, waitedStep, {
    ...hookOpts(ctx),
    index: stepIndex,
    cause: "timeout",
  });
  const hasMoved = !ctx.state.isInitialized || !isCurrent(ctx, activation) || hasElementWait(ctx);
  if (result === false || hasMoved) {
    return;
  }

  ctx.tour.drive(stepIndex, true);
}

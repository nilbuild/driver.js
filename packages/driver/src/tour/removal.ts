import type { Activation, Context } from "../core/context";
import { rebindActiveElement } from "./highlight";
import { stepOption } from "../core/options";
import { isBusy, isLeaving } from "./lifecycle";
import { isActionStep, markStepPopoverWaiting } from "./step";
import type { DriveStep, ElementMissing, ElementMissingPreset } from "../types";
import { isDummyElement, resolveElement } from "../core/utils";
import { clearWaiting } from "./wait";

export function resolveMissing(ctx: Context, step: DriveStep): ElementMissing {
  return stepOption(ctx, step, "onElementMissing") ?? "stay";
}

function goBack(ctx: Context, preset: ElementMissingPreset) {
  const activeIndex = ctx.getState("activeIndex");
  if (!activeIndex) {
    return;
  }

  const steps = ctx.getConfig("steps") || [];
  for (let index = activeIndex - 1; preset === "previousAction" && index >= 0; index--) {
    const candidate = steps[index];
    if (isActionStep(candidate) && candidate.element && resolveElement(candidate.element)?.isConnected) {
      ctx.tour.drive(index);
      return;
    }
  }

  ctx.tour.drive(activeIndex - 1);
}

export function watchForRemoval(ctx: Context, activation: Activation) {
  const { step } = activation;
  const { signal } = activation.controller;
  if (!step.element) {
    return;
  }

  let frame: number | undefined;
  let graceTimer: number | undefined;
  let hasReported = false;

  const restore = (element: Element) => {
    window.clearTimeout(graceTimer);
    graceTimer = undefined;
    hasReported = false;
    rebindActiveElement(ctx, element);
    if (!isLeaving(ctx, activation)) {
      clearWaiting(ctx);
    }
  };

  const recover = () => {
    const replacement = resolveElement(step.element);
    if (!replacement || !replacement.isConnected) {
      return false;
    }

    restore(replacement);
    return true;
  };

  const report = (element: Element) => {
    hasReported = true;
    clearWaiting(ctx);

    const missing = resolveMissing(ctx, step);
    if (typeof missing === "function") {
      missing(element, step, { ...ctx.getHookOpts(), cause: "removed" });
      return;
    }

    if (missing !== "stay") {
      goBack(ctx, missing);
    }
  };

  const check = () => {
    frame = undefined;
    const element = ctx.getState("activeElement");
    if (signal.aborted || !element || isDummyElement(element)) {
      return;
    }

    if (element.isConnected) {
      if (hasReported || graceTimer !== undefined) {
        restore(element);
      }

      return;
    }

    if (isBusy(ctx, activation) || recover() || hasReported || graceTimer) {
      return;
    }

    if (resolveMissing(ctx, step) === "stay") {
      return;
    }

    const grace = stepOption(ctx, step, "waitForElement") ?? 0;
    if (grace <= 0) {
      report(element);
      return;
    }

    markStepPopoverWaiting(ctx, "missing");
    graceTimer = window.setTimeout(() => {
      graceTimer = undefined;
      if (signal.aborted || isBusy(ctx, activation) || recover()) {
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

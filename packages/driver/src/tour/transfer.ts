import { hookOpts } from "../core/context";
import type { Context } from "../core/context";
import type { DriveStep } from "../types";
import { isDummyElement } from "../core/utils";
import { isCurrent } from "./lifecycle";

export type CommitTransfer = (targetElement: Element | undefined) => void;

export function startTransfer(
  ctx: Context,
  toElement: Element | undefined,
  toStep: DriveStep
): CommitTransfer | undefined {
  const activation = ctx.state.__activation;
  const isSuperseded = () => !isCurrent(ctx, activation);

  const fromStep = ctx.state.__activeStep;
  const fromElement = ctx.state.__activeElement || (fromStep ? undefined : toElement);

  const highlightStartedHook = toStep.onHighlightStarted || ctx.config.onHighlightStarted;
  const highlightedHook = toStep.onHighlighted || ctx.config.onHighlighted;
  const deselectedHook = fromStep?.onDeselected || ctx.config.onDeselected;
  const signal = activation?.controller.signal;

  const startOpts = hookOpts(ctx);

  if (fromStep && fromStep !== toStep && deselectedHook) {
    deselectedHook(isDummyElement(fromElement) ? undefined : fromElement, fromStep, startOpts);
    if (isSuperseded()) {
      return undefined;
    }
  }

  if (highlightStartedHook) {
    highlightStartedHook(isDummyElement(toElement) ? undefined : toElement, toStep, { ...startOpts, signal });
    if (isSuperseded()) {
      return undefined;
    }
  }

  ctx.state.previousStep = fromStep;
  ctx.state.previousElement = fromElement;
  ctx.state.activeStep = toStep;
  ctx.state.activeElement = toElement;

  return targetElement => {
    ctx.state.__previousStep = fromStep;
    ctx.state.__previousElement = fromElement;
    ctx.state.__activeStep = toStep;
    ctx.state.__activeElement = targetElement;

    if (highlightedHook) {
      highlightedHook(isDummyElement(toElement) ? undefined : targetElement, toStep, { ...hookOpts(ctx), signal });
    }
  };
}

export function reboundElement<T extends Element | undefined>(
  ctx: Context,
  toStep: DriveStep,
  toElement: T
): Element | T {
  const rebound = ctx.state.activeStep === toStep ? ctx.state.activeElement : undefined;

  return rebound || toElement;
}

import type { Activation, Context, StepWait } from "../core/context";
import type { DriveStep } from "../types";

export function beginActivation(ctx: Context, step: DriveStep, placeholder?: Activation["placeholder"]): Activation {
  endActivation(ctx);

  const activation: Activation = {
    step,
    controller: new AbortController(),
    placeholder,
    latched: false,
  };
  ctx.setState("__activation", activation);
  ctx.setState("__lastAnnouncement", undefined);

  return activation;
}

export function endActivation(ctx: Context) {
  const activation = ctx.getState("__activation");
  if (!activation) {
    return;
  }

  ctx.setState("__activation", undefined);
  activation.controller.abort();
}

export function isCurrent(ctx: Context, activation: Activation | undefined): boolean {
  return ctx.getState("__activation") === activation;
}

export function enterStep(ctx: Context, stepIndex: number, keepReturnFocus: boolean) {
  if (!ctx.getState("__keepReturnFocus")) {
    ctx.setState("__activeOnDestroyed", document.activeElement as HTMLElement);
  }
  ctx.setState("__keepReturnFocus", keepReturnFocus);
  ctx.setState("activeIndex", stepIndex);
}

export function beginTransition(ctx: Context, frame: () => void) {
  ctx.setState("__transitionCallback", frame);
}

export function isTransitioning(ctx: Context): boolean {
  return !!ctx.getState("__transitionCallback");
}

export function ownsTransition(ctx: Context, frame: () => void): boolean {
  return ctx.getState("__transitionCallback") === frame;
}

export function endTransition(ctx: Context): boolean {
  const hasMissedRefresh = !!ctx.getState("__refreshMissed");
  ctx.setState("__transitionCallback", undefined);
  if (hasMissedRefresh) {
    ctx.setState("__refreshMissed", false);
  }

  return hasMissedRefresh;
}

export function missRefresh(ctx: Context) {
  ctx.setState("__refreshMissed", true);
}

export function setWait(ctx: Context, wait: StepWait) {
  const activation = ctx.getState("__activation");
  if (activation) {
    activation.wait = wait;
  }
}

export function clearWait(ctx: Context): boolean {
  const activation = ctx.getState("__activation");
  if (!activation?.wait) {
    return false;
  }

  activation.wait = undefined;

  return true;
}

export function isWaiting(ctx: Context): boolean {
  return !!ctx.getState("__activation")?.wait;
}

export function setElementWait(ctx: Context, cancel?: () => void) {
  ctx.setState("__pendingWaitCancel", cancel);
}

export function hasElementWait(ctx: Context): boolean {
  return !!ctx.getState("__pendingWaitCancel");
}

export function cancelElementWait(ctx: Context) {
  const cancel = ctx.getState("__pendingWaitCancel");
  if (!cancel) {
    return;
  }

  setElementWait(ctx);
  cancel();
}

export function placeholderOf(ctx: Context) {
  const activation = ctx.getState("__activation");

  return activation?.placeholder && { ...activation.placeholder, step: activation.step };
}

export function dropPlaceholder(ctx: Context): boolean {
  const activation = ctx.getState("__activation");
  if (!activation?.placeholder) {
    return false;
  }

  activation.placeholder = undefined;

  return true;
}

export function setSettling(activation: Activation, isSettling: boolean) {
  activation.settling = isSettling;
}

export function latch(ctx: Context, activation: Activation): boolean {
  if (!isCurrent(ctx, activation) || activation.latched) {
    return false;
  }

  activation.latched = true;

  return true;
}

export function markDone(activation: Activation) {
  activation.done = true;
}

export function unlatch(ctx: Context, activation: Activation) {
  if (!isCurrent(ctx, activation) || hasElementWait(ctx)) {
    return;
  }

  activation.latched = false;
  activation.recheck?.();
}

export function isLeaving(ctx: Context, activation: Activation): boolean {
  return activation.latched || hasElementWait(ctx);
}

export function isBusy(ctx: Context, activation: Activation): boolean {
  return !!activation.settling || isLeaving(ctx, activation);
}

export function isDone(ctx: Context, step: DriveStep): boolean {
  const activation = ctx.getState("__activation");

  return activation?.step === step && !!activation.done;
}

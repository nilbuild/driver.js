import { hookOpts } from "../core/context";
import type { Context, ControlActions } from "../core/context";
import type { AllowedButtons } from "../popover/popover";
import type { DestroyReason } from "../types";
import { isDone, isTransitioning, isWaiting, popoverStep } from "../tour/lifecycle";
import { isActionStep, isStandalone, resolvePrevHook, resolveStepButtons } from "../tour/step";
import { popoverTarget } from "../tour/wait";

function canSkipStep(ctx: Context) {
  const step = ctx.state.__activation?.step ?? popoverStep(ctx);

  return !isWaiting(ctx) && !isActionStep(step);
}

function nudgeIfGated(ctx: Context): boolean {
  const activation = ctx.state.__activation;
  if (!isActionStep(activation?.step ?? popoverStep(ctx))) {
    return false;
  }

  if (!(activation && isDone(ctx, activation.step)) && !isWaiting(ctx)) {
    ctx.ui.nudge(ctx);
  }

  return true;
}

function canUseButton(ctx: Context, button: AllowedButtons) {
  if (button === "previous" && isWaiting(ctx)) {
    return false;
  }

  if (button === "next" && !canSkipStep(ctx)) {
    return false;
  }

  const buttons = resolveStepButtons(ctx, popoverStep(ctx));

  return buttons.showButtons.includes(button) && !buttons.disableButtons.includes(button);
}

function requestClose(ctx: Context, reason: DestroyReason = "close") {
  if (!ctx.config.allowClose) {
    return;
  }

  ctx.tour.destroy(reason);
}

function escape(ctx: Context) {
  if (resolveStepButtons(ctx, popoverStep(ctx)).disableButtons.includes("close")) {
    return;
  }

  requestClose(ctx, "escape");
}

function pressNext(ctx: Context) {
  if (!nudgeIfGated(ctx)) {
    ctx.tour.next();
  }
}

function previous(ctx: Context) {
  const { element, step } = popoverTarget(ctx);
  const onPrevClick = resolvePrevHook(ctx, step);
  if (!step || !onPrevClick) {
    if (!isStandalone(step)) {
      ctx.tour.movePrevious();
    }
    return;
  }

  onPrevClick(element, step, hookOpts(ctx));
}

function overlayClick(ctx: Context) {
  const overlayClickBehavior = ctx.config.overlayClickBehavior;

  if (typeof overlayClickBehavior !== "function" && overlayClickBehavior !== "none" && nudgeIfGated(ctx)) {
    return;
  }

  if (ctx.config.allowClose && overlayClickBehavior === "close") {
    ctx.tour.destroy("overlay");
    return;
  }

  if (typeof overlayClickBehavior === "function") {
    ctx.state.__destroyReason = "overlay";

    const step = popoverStep(ctx) ?? ctx.state.activeStep;
    if (step) {
      overlayClickBehavior(ctx.state.__activeElement, step, hookOpts(ctx));
    }

    return;
  }

  if (overlayClickBehavior === "nextStep" && canSkipStep(ctx)) {
    ctx.tour.next();
  }
}

function arrowLeft(ctx: Context) {
  const activeIndex = ctx.state.activeIndex;
  if (isTransitioning(ctx) || activeIndex === undefined || !ctx.state.__activeStep) {
    return;
  }

  const steps = ctx.config.steps || [];
  if (!steps[activeIndex - 1] || !canUseButton(ctx, "previous")) {
    return;
  }

  previous(ctx);
}

function arrowRight(ctx: Context) {
  const hasStep = ctx.state.activeIndex !== undefined && !!popoverStep(ctx);
  if (isTransitioning(ctx) || !hasStep || nudgeIfGated(ctx) || !canUseButton(ctx, "next")) {
    return;
  }

  ctx.tour.next();
}

export function createControls(ctx: Context): ControlActions {
  return {
    pressNext: () => pressNext(ctx),
    previous: () => previous(ctx),
    requestClose: () => requestClose(ctx),
    overlayClick: () => overlayClick(ctx),
    escape: () => escape(ctx),
    arrowLeft: () => arrowLeft(ctx),
    arrowRight: () => arrowRight(ctx),
  };
}

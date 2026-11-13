import type { Context } from "../core/context";
import type { Renderer } from "../core/renderer";
import type { DriveStep } from "../types";
import { resolveElement } from "../core/utils";
import { initGate } from "../interaction/gate";
import {
  beginActivation,
  beginTransition,
  dropPlaceholder,
  endTransition,
  enterStep,
  ownsTransition,
} from "../tour/lifecycle";
import { resolveTourStep } from "../tour/step";
import { markWaiting } from "../tour/wait";
import { reboundElement, startTransfer } from "../tour/transfer";
import { resolveAllowedElements, resolveAllowedSetting } from "../tour/allowed";

function highlight(ctx: Context, step: DriveStep) {
  const element = resolveElement(step.element) || undefined;
  const commitTransfer = startTransfer(ctx, element, step);
  if (!commitTransfer) {
    return;
  }

  ctx.state.__activeStep = step;
  ctx.state.__activeElement = element;

  const settle = () => {
    if (!ownsTransition(ctx, settle)) {
      return;
    }

    commitTransfer(reboundElement(ctx, step, element));
    if (ownsTransition(ctx, settle)) {
      endTransition(ctx);
    }
  };

  beginTransition(ctx, settle);
  queueMicrotask(settle);
}

function rebind(ctx: Context, element: Element) {
  if (!ctx.state.activeStep) {
    return;
  }

  ctx.state.activeElement = element;
  ctx.state.__activeElement = element;
}

function showInitialWait(ctx: Context, stepIndex: number) {
  enterStep(ctx, stepIndex, true);
  beginActivation(ctx, resolveTourStep(ctx, stepIndex), { index: stepIndex });
  markWaiting(ctx, "initial");
}

// nothing is marked on the page, so the allowed elements are looked up when a click comes in
function isAllowed(ctx: Context, path: EventTarget[]): boolean {
  const step = ctx.state.activeStep;
  if (!step) {
    return false;
  }

  const allowed = resolveAllowedElements(resolveAllowedSetting(ctx, step));

  return allowed.length > 0 && path.some(node => node instanceof Element && allowed.includes(node));
}

const noop = () => {};

export const headlessRenderer: Renderer = {
  blocksInteraction: false,
  mount: ctx => {
    ctx.state.__teardownGate = initGate(ctx);
  },
  detach: noop,
  unmount: ctx => ctx.state.__teardownGate?.(),
  highlight,
  rebind,
  refresh: ctx => ctx.state.__activation?.recheck?.(),
  trackAllowed: noop,
  isAllowed,
  showWaiting: noop,
  hideWaiting: noop,
  showInitialWait,
  endInitialWait: dropPlaceholder,
  refreshPopover: noop,
  nudge: noop,
  announce: noop,
  restoreFocus: noop,
};

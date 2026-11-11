import type { Activation, Context } from "../core/context";
import { stepOption } from "../core/options";
import { announce } from "../popover/live-region";
import { isCurrent, latch, markDone, unlatch } from "./lifecycle";
import { isActionStep } from "./step";

export function requestCompletion(ctx: Context, activation: Activation) {
  if (!latch(ctx, activation)) {
    return;
  }

  const delay = stepOption(ctx, activation.step, "advanceDelay") ?? 0;
  if (delay <= 0) {
    ctx.tour.next();
    unlatch(ctx, activation);
    return;
  }

  markDone(activation);
  ctx.tour.refreshPopover();
  if (isActionStep(activation.step)) {
    announce(ctx, activation.step.popover?.doneBtnText || ctx.getConfig("doneBtnText") || "Done");
  }

  const timer = window.setTimeout(() => {
    if (!isCurrent(ctx, activation)) {
      return;
    }

    ctx.tour.next();
    unlatch(ctx, activation);
  }, delay);
  activation.controller.signal.addEventListener("abort", () => window.clearTimeout(timer));
}

import type { Context } from "../core/context";
import type { Renderer } from "../core/renderer";
import { destroyEvents, initEvents, requireRefresh } from "../interaction/events";
import { announce, destroyLiveRegion, mountLiveRegion } from "../popover/live-region";
import { destroyPopover } from "../popover/popover";
import { destroyOverlay } from "../overlay/overlay";
import { trackAllowedElements } from "../tour/allowed";
import { createControls } from "./controls";
import {
  destroyHighlight,
  highlight,
  mountDummyElement,
  rebindActiveElement,
  removeDummyElement,
} from "../tour/highlight";
import { beginActivation, dropPlaceholder, enterStep } from "../tour/lifecycle";
import { nudge } from "../tour/nudge";
import {
  hidePopoverWaiting,
  popoverText,
  renderStepPopover,
  resolveTourStep,
  showPopoverWaiting,
  updateStepPopover,
} from "../tour/step";
import { markWaiting, popoverTarget } from "../tour/wait";

function mount(ctx: Context) {
  document.body.classList.add("driver-active", ctx.config.animate ? "driver-fade" : "driver-simple");
  if (!ctx.config.allowScroll) {
    document.body.classList.add("driver-no-scroll");
  }
  document.body.style.setProperty("--driver-animation-duration", `${ctx.config.duration || 400}ms`);

  initEvents(ctx);
  mountLiveRegion(ctx);
}

function detach() {
  document.body.classList.remove("driver-active", "driver-fade", "driver-simple", "driver-no-scroll");
  document.body.style.removeProperty("--driver-animation-duration");
}

function unmount(ctx: Context) {
  destroyEvents(ctx);
  destroyLiveRegion(ctx);
  destroyPopover(ctx.state.popover);
  destroyHighlight(ctx);
  destroyOverlay(ctx);
}

function showInitialWait(ctx: Context, stepIndex: number) {
  const step = resolveTourStep(ctx, stepIndex);
  if (!step.popover) {
    return;
  }

  const element = mountDummyElement();
  enterStep(ctx, stepIndex, true);
  beginActivation(ctx, step, { element, index: stepIndex });
  renderStepPopover(ctx, element, step);
  markWaiting(ctx, "initial");
}

function endInitialWait(ctx: Context) {
  if (!dropPlaceholder(ctx)) {
    return;
  }

  destroyPopover(ctx.state.popover);
  ctx.state.popover = undefined;
  removeDummyElement();
}

function refreshPopover(ctx: Context) {
  const activation = ctx.state.__activation;
  if (!activation) {
    return;
  }

  const popover = ctx.state.popover;
  const { element, step } = popoverTarget(ctx);
  if (!popover || !element || step !== activation.step) {
    return;
  }

  if (popover.wrapper.style.display === "none" || !popover.wrapper.isConnected) {
    return;
  }

  const before = popoverText(popover);
  updateStepPopover(ctx, element, activation.step);

  const changed = popoverText(popover).filter((text, index) => text && text !== before[index]);
  announce(ctx, changed.join(". "));
}

export const domRenderer: Renderer = {
  blocksInteraction: true,
  controls: createControls,
  mount,
  detach,
  unmount,
  highlight,
  rebind: rebindActiveElement,
  refresh: requireRefresh,
  trackAllowed: trackAllowedElements,
  showWaiting: showPopoverWaiting,
  hideWaiting: hidePopoverWaiting,
  showInitialWait,
  endInitialWait,
  refreshPopover,
  nudge,
  announce,
  restoreFocus: element => (element as HTMLElement).focus(),
};

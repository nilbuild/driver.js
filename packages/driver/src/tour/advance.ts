import { hookOpts } from "../core/context";
import type { Activation, Context } from "../core/context";
import { advanceEvents, isClickGesture, usesAdvanceOnClick } from "../core/options";
import type { AdvanceOn } from "../types";
import { isTransitioning, setSettling } from "./lifecycle";

const MULTI_CLICK_MS = 500;
const SAME_SPOT_PX = 8;

export function isOnPath(event: Event, element: Element | undefined): boolean {
  if (!element) {
    return false;
  }

  const path = event.composedPath();
  if (path.length > 0) {
    return path.includes(element);
  }

  return event.target instanceof Node && element.contains(event.target);
}

export function listenForAdvanceEvents(
  ctx: Context,
  advanceOn: Exclude<AdvanceOn, false>,
  activation: Activation,
  onComplete: () => void
) {
  const { signal } = activation.controller;
  const { types, when } = advanceEvents(advanceOn);

  const isLegacyClickDuringTransition = () => usesAdvanceOnClick(ctx, activation.step) && isTransitioning(ctx);

  const isRestOfCompletingMultiClick = (event: Event) => {
    const completingClick = ctx.state.__advanceClick;
    const click = event as MouseEvent;
    if (!completingClick || click.detail < 2 || click.timeStamp - completingClick.timeStamp > MULTI_CLICK_MS) {
      return false;
    }

    return (
      Math.abs(click.clientX - completingClick.clientX) < SAME_SPOT_PX &&
      Math.abs(click.clientY - completingClick.clientY) < SAME_SPOT_PX
    );
  };

  const isStrayClick = (event: Event) => isLegacyClickDuringTransition() || isRestOfCompletingMultiClick(event);

  const isMet = (event: Event) => {
    if (!when) {
      return true;
    }

    const element = ctx.state.activeElement;
    return !!element && when(element, activation.step, { ...hookOpts(ctx), event });
  };

  let pendingEvent: Event | undefined;
  let pendingTimer: number | undefined;

  const settle = (event: Event) => {
    if (pendingEvent !== event) {
      return;
    }

    window.clearTimeout(pendingTimer);
    pendingEvent = undefined;
    pendingTimer = undefined;
    setSettling(activation, false);

    if (signal.aborted) {
      return;
    }

    if (!ctx.consumed.has(event) && isMet(event)) {
      if (isClickGesture(event.type)) {
        ctx.state.__advanceClick = event as MouseEvent;
      }

      onComplete();
    }

    activation.recheck?.();
  };

  const onCapture = (event: Event) => {
    if (!isOnPath(event, ctx.state.activeElement)) {
      return;
    }

    if (isClickGesture(event.type) && isStrayClick(event)) {
      return;
    }

    pendingEvent = event;
    setSettling(activation, true);
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => settle(event), 0);
  };

  for (const type of types) {
    window.addEventListener(type, onCapture, { capture: true, signal });
    window.addEventListener(type, settle, { signal });
  }

  signal.addEventListener("abort", () => window.clearTimeout(pendingTimer));
}

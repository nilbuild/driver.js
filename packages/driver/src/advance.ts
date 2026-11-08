import type { AdvanceOn, Context } from "./context";
import type { DriveStep } from "./driver";

export function resolveAdvanceOn(ctx: Context, step: DriveStep): AdvanceOn | undefined {
  if (step.advanceOn !== undefined) {
    return step.advanceOn || undefined;
  }

  if (step.advanceOnClick !== undefined) {
    return step.advanceOnClick ? "click" : undefined;
  }

  const advanceOn = ctx.getConfig("advanceOn");
  if (advanceOn !== undefined) {
    return advanceOn || undefined;
  }

  return ctx.getConfig("advanceOnClick") ? "click" : undefined;
}

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
  eventTypes: string[],
  signal: AbortSignal,
  onComplete: () => void
) {
  let pendingEvent: Event | undefined;
  let pendingTimer: number | undefined;

  const settle = (event: Event) => {
    if (pendingEvent !== event) {
      return;
    }

    window.clearTimeout(pendingTimer);
    pendingEvent = undefined;
    pendingTimer = undefined;

    if (signal.aborted || ctx.isConsumed(event)) {
      return;
    }

    onComplete();
  };

  const onCapture = (event: Event) => {
    if (!isOnPath(event, ctx.getState("activeElement"))) {
      return;
    }

    pendingEvent = event;
    window.clearTimeout(pendingTimer);
    pendingTimer = window.setTimeout(() => settle(event), 0);
  };

  for (const type of eventTypes) {
    window.addEventListener(type, onCapture, { capture: true, signal });
    window.addEventListener(type, settle, { signal });
  }

  signal.addEventListener("abort", () => window.clearTimeout(pendingTimer));
}

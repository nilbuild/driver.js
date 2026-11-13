import type { Context } from "../core/context";
import { regionOf } from "./region";
import { advanceEvents, GESTURE_PARTS, isClickGesture, resolveAdvanceOn, stepOption } from "../core/options";
import type { DriveStep } from "../types";

const BUTTON_EVENTS = new Set<string>(["pointerdown", "mousedown", "pointerup", "mouseup"]);
export const GATED_EVENTS = ["click", "auxclick", "contextmenu", "dblclick"] as const;

function gesturePartOf(event: Event): string | undefined {
  if (!(event instanceof MouseEvent)) {
    return undefined;
  }

  if (BUTTON_EVENTS.has(event.type)) {
    return `press${event.button}`;
  }

  return (GATED_EVENTS as readonly string[]).includes(event.type) ? event.type : undefined;
}

function strictGestures(ctx: Context, step: DriveStep): string[] | undefined {
  const { types, strict } = advanceEvents(resolveAdvanceOn(ctx, step));
  if (!strict || !types.length) {
    return undefined;
  }

  return types.every(isClickGesture) ? types : undefined;
}

export type ElementBlock = "disabled" | "strict";

export function elementBlockOf(ctx: Context, event: Event): ElementBlock | undefined {
  const step = ctx.state.activeStep;
  const part = gesturePartOf(event);
  if (!step || !part || regionOf(ctx, event.composedPath()) !== "element") {
    return undefined;
  }

  if (ctx.ui.blocksInteraction && stepOption(ctx, step, "disableActiveInteraction")) {
    return "disabled";
  }

  const expected = strictGestures(ctx, step);
  if (!expected || expected.some(type => GESTURE_PARTS[type].includes(part))) {
    return undefined;
  }

  return "strict";
}

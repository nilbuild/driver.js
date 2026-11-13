import type { Context } from "./context";
import type { AdvanceOn, AdvanceOnEvent, Config, DriveStep } from "../types";

type SharedOption = keyof DriveStep & keyof Config;

export function stepOption<K extends SharedOption>(ctx: Context, step: DriveStep | undefined, key: K): Config[K] {
  return (step?.[key] ?? ctx.config[key]) as Config[K];
}

export function resolveAdvanceOn(ctx: Context, step: DriveStep): AdvanceOn | undefined {
  if (step.advanceOn !== undefined) {
    return step.advanceOn || undefined;
  }

  if (step.advanceOnClick !== undefined) {
    return step.advanceOnClick ? "click" : undefined;
  }

  const advanceOn = ctx.config.advanceOn;
  if (advanceOn !== undefined) {
    return advanceOn || undefined;
  }

  return ctx.config.advanceOnClick ? "click" : undefined;
}

export function usesAdvanceOnClick(ctx: Context, step: DriveStep): boolean {
  if (step.advanceOn !== undefined) {
    return false;
  }

  return step.advanceOnClick ?? (ctx.config.advanceOn === undefined && !!ctx.config.advanceOnClick);
}

export type AdvanceEvents = {
  types: string[];
  when?: AdvanceOnEvent["when"];
  strict?: boolean;
};

export function advanceEvents(advanceOn: AdvanceOn | undefined): AdvanceEvents {
  if (!advanceOn) {
    return { types: [] };
  }

  if (typeof advanceOn === "string" || Array.isArray(advanceOn)) {
    return { types: [advanceOn].flat() };
  }

  return { types: [advanceOn.event].flat(), when: advanceOn.when, strict: advanceOn.strict };
}

const LEFT_CLICK = ["press0", "click"];
export const GESTURE_PARTS: Record<string, string[]> = {
  click: LEFT_CLICK,
  dblclick: [...LEFT_CLICK, "dblclick"],
  mousedown: LEFT_CLICK,
  mouseup: LEFT_CLICK,
  pointerdown: LEFT_CLICK,
  pointerup: LEFT_CLICK,
  contextmenu: ["press2", "contextmenu", "auxclick"],
  auxclick: ["press1", "press2", "auxclick"],
};

export function isClickGesture(type: string): boolean {
  return type in GESTURE_PARTS;
}

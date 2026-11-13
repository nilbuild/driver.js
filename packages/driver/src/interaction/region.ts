import type { Context } from "../core/context";
import type { InteractionRegion } from "../types";
import { isDummyElement } from "../core/utils";

type Region = InteractionRegion | "popover";

export function isOnElement(ctx: Context, path: EventTarget[]): boolean {
  const element = ctx.state.activeElement;

  return !isDummyElement(element) && !!element && path.includes(element);
}

export function regionOf(ctx: Context, path: EventTarget[]): Region {
  const popover = ctx.state.popover?.wrapper;
  if (popover && path.includes(popover)) {
    return "popover";
  }

  if (isOnElement(ctx, path)) {
    return "element";
  }

  return ctx.ui.isAllowed(ctx, path) ? "allowed" : "outside";
}

export function pathOf(node: Node | null): EventTarget[] {
  const path: EventTarget[] = [];
  for (let current: Node | null = node; current; ) {
    path.push(current);
    current = current.parentNode || (current instanceof ShadowRoot ? current.host : null);
  }

  return path;
}

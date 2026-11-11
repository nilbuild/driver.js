import { ALLOWED_CLASS } from "../tour/allowed";
import type { Context } from "../core/context";
import type { InteractionRegion } from "../types";
import { isDummyElement } from "../core/utils";

type Region = InteractionRegion | "popover";

export function regionOf(ctx: Context, path: EventTarget[]): Region {
  const popover = ctx.getState("popover")?.wrapper;
  if (popover && path.includes(popover)) {
    return "popover";
  }

  const element = ctx.getState("activeElement");
  if (!isDummyElement(element) && path.includes(element!)) {
    return "element";
  }

  const isAllowed = path.some(node => node instanceof Element && node.classList.contains(ALLOWED_CLASS));

  return isAllowed ? "allowed" : "outside";
}

export function pathOf(node: Node | null): EventTarget[] {
  const path: EventTarget[] = [];
  for (let current: Node | null = node; current; ) {
    path.push(current);
    current = current.parentNode || (current instanceof ShadowRoot ? current.host : null);
  }

  return path;
}

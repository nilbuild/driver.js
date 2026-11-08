import type { Context, InteractionRegion } from "./context";
import { ALLOWED_CLASS } from "./allowed";
import { isDummyElement, isKeyWidget } from "./utils";

const GATED_EVENTS = ["click", "auxclick", "contextmenu", "dblclick"] as const;

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

function isInPlay(ctx: Context, path: EventTarget[]): boolean {
  const region = regionOf(ctx, path);

  return region === "element" || region === "allowed";
}

export function isKeyInPlay(ctx: Context, path: EventTarget[]): boolean {
  return isKeyWidget(path[0]) && isInPlay(ctx, path);
}

export function isFocusInPlay(ctx: Context): boolean {
  return isKeyInPlay(ctx, pathOf(document.activeElement));
}

export function keyId(event: KeyboardEvent): string {
  return event.code || event.key;
}

function consume(ctx: Context, event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  ctx.consume(event);
}

export function handledKeys(ctx: Context): Set<string> {
  let keys = ctx.getState("__handledKeys");
  if (!keys) {
    keys = new Set();
    ctx.setState("__handledKeys", keys);
  }

  return keys;
}

function onGatedEvent(ctx: Context, event: MouseEvent) {
  if (!ctx.getState("isInitialized")) {
    return;
  }

  const step = ctx.getState("activeStep");
  const onInteraction = step?.onInteraction || ctx.getConfig("onInteraction");
  if (!step || !onInteraction) {
    return;
  }

  if (event.type === "auxclick" && event.button === 2) {
    return;
  }

  const region = regionOf(ctx, event.composedPath());
  if (region === "popover") {
    return;
  }

  const element = ctx.getState("activeElement");
  const result = onInteraction(isDummyElement(element) ? undefined : element, step, {
    ...ctx.getHookOpts(),
    event,
    region,
  });

  if (result === false) {
    consume(ctx, event);
  }
}

export function initGate(ctx: Context): () => void {
  const controller = new AbortController();
  const listener = (event: MouseEvent) => onGatedEvent(ctx, event);

  for (const type of GATED_EVENTS) {
    window.addEventListener(type, listener, { capture: true, signal: controller.signal });
  }

  window.addEventListener("blur", () => ctx.setState("__widgetKey", undefined), { signal: controller.signal });

  return () => controller.abort();
}

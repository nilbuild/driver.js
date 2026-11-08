import type { Context, InteractionRegion } from "./context";
import { ALLOWED_CLASS } from "./allowed";
import { isDummyElement } from "./utils";

const GATED_EVENTS = ["click", "auxclick", "contextmenu", "dblclick", "keydown", "keyup"] as const;
const DRIVER_KEYS = ["Escape", "ArrowLeft", "ArrowRight"];

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

export function isInPlay(ctx: Context, path: EventTarget[]): boolean {
  const region = regionOf(ctx, path);

  return region === "element" || region === "allowed";
}

export function isFocusInPlay(ctx: Context): boolean {
  return isInPlay(ctx, pathOf(document.activeElement));
}

export function keyId(event: KeyboardEvent): string {
  return event.code || event.key;
}

function consume(ctx: Context, event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  ctx.consume(event);
}

export function keySet(ctx: Context, name: "__rejectedKeys" | "__handledKeys"): Set<string> {
  let keys = ctx.getState(name);
  if (!keys) {
    keys = new Set();
    ctx.setState(name, keys);
  }

  return keys;
}

function isUnreportedKey(ctx: Context, event: KeyboardEvent, region: Region): boolean {
  if (event.key === "Tab" || event.isComposing || event.keyCode === 229) {
    return true;
  }

  const isDriverKey = DRIVER_KEYS.includes(event.key) && ctx.getConfig("allowKeyboardControl") !== false;

  return isDriverKey && region === "outside";
}

function onGatedEvent(ctx: Context, event: Event) {
  if (!ctx.getState("isInitialized")) {
    return;
  }

  const rejected = keySet(ctx, "__rejectedKeys");
  if (event instanceof KeyboardEvent) {
    const id = keyId(event);
    if (event.type === "keyup") {
      if (rejected.delete(id)) {
        if (ctx.getState("__widgetKey") === id) {
          ctx.setState("__widgetKey", undefined);
        }
        ctx.getState("__handledKeys")?.delete(id);
        consume(ctx, event);
      }

      return;
    }

    if (event.repeat && rejected.has(id)) {
      consume(ctx, event);
      return;
    }
  }

  const step = ctx.getState("activeStep");
  const onInteraction = step?.onInteraction || ctx.getConfig("onInteraction");
  if (!step || !onInteraction) {
    return;
  }

  if (event.type === "auxclick" && (event as MouseEvent).button === 2) {
    return;
  }

  const region = regionOf(ctx, event.composedPath());
  if (region === "popover") {
    return;
  }

  if (event instanceof KeyboardEvent && isUnreportedKey(ctx, event, region)) {
    return;
  }

  const element = ctx.getState("activeElement");
  const result = onInteraction(isDummyElement(element) ? undefined : element, step, {
    ...ctx.getHookOpts(),
    event: event as MouseEvent | KeyboardEvent,
    region,
  });

  if (result !== false) {
    return;
  }

  consume(ctx, event);
  if (event instanceof KeyboardEvent) {
    rejected.add(keyId(event));
  }
}

export function initGate(ctx: Context): () => void {
  const controller = new AbortController();
  const listener = (event: Event) => onGatedEvent(ctx, event);

  window.addEventListener(
    "keydown",
    event => {
      if (isInPlay(ctx, event.composedPath())) {
        ctx.setState("__widgetKey", keyId(event));
      }
    },
    { capture: true, signal: controller.signal }
  );

  for (const type of GATED_EVENTS) {
    window.addEventListener(type, listener, { capture: true, signal: controller.signal });
  }

  window.addEventListener(
    "blur",
    () => {
      keySet(ctx, "__rejectedKeys").clear();
      ctx.setState("__widgetKey", undefined);
    },
    { signal: controller.signal }
  );

  return () => controller.abort();
}

import type { Activation, Context } from "../core/context";
import { pathOf, regionOf } from "./region";
import { isKeyWidget } from "../core/utils";
import { isPageInteractive } from "../core/options";

function isInPlay(ctx: Context, path: EventTarget[]): boolean {
  const region = regionOf(ctx, path);

  return region === "element" || region === "allowed" || (region === "outside" && isPageInteractive(ctx));
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

export function handledKeys(ctx: Context): Set<string> {
  let keys = ctx.state.__handledKeys;
  if (!keys) {
    keys = new Set();
    ctx.state.__handledKeys = keys;
  }

  return keys;
}

export function isKeyCarriedOverFromEarlierStep(ctx: Context, event: KeyboardEvent): boolean {
  const pressedIn = ctx.state.__pressedKeys;
  const id = keyId(event);

  return pressedIn?.has(id) ? pressedIn.get(id) !== ctx.state.__activation : event.repeat;
}

export function trackPressedKeys(ctx: Context): () => void {
  const controller = new AbortController();
  const pressedIn = new Map<string, Activation | undefined>();
  ctx.state.__pressedKeys = pressedIn;

  const keepCarriedOverKeysOffPopover = (event: Event) => {
    const key = event as KeyboardEvent;
    if (key.type === "keydown" && !key.repeat) {
      pressedIn.set(keyId(key), ctx.state.__activation);
    }

    const popover = ctx.state.popover?.wrapper;
    if (popover && key.composedPath().includes(popover) && isKeyCarriedOverFromEarlierStep(ctx, key)) {
      key.preventDefault();
    }
  };
  ["keydown", "keypress", "keyup"].forEach(type =>
    window.addEventListener(type, keepCarriedOverKeysOffPopover, { capture: true, signal: controller.signal })
  );

  window.addEventListener(
    "blur",
    () => {
      ctx.state.__widgetKey = undefined;
      pressedIn.clear();
    },
    { signal: controller.signal }
  );

  return () => controller.abort();
}

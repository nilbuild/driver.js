import type { Context } from "../core/context";
import { pathOf, regionOf } from "./region";
import { isKeyWidget } from "../core/utils";

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

export function handledKeys(ctx: Context): Set<string> {
  let keys = ctx.getState("__handledKeys");
  if (!keys) {
    keys = new Set();
    ctx.setState("__handledKeys", keys);
  }

  return keys;
}

export function isKeyCarriedOverFromEarlierStep(ctx: Context, event: KeyboardEvent): boolean {
  const pressedIn = ctx.getState("__pressedKeys");
  const id = keyId(event);

  return pressedIn?.has(id) ? pressedIn.get(id) !== ctx.getState("__activation") : event.repeat;
}

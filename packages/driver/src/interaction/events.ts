import { Context } from "../core/context";
import { refreshActiveHighlight } from "../tour/highlight";
import { getFocusableElements } from "../core/utils";
import { initGate } from "./gate";
import {
  handledKeys,
  isFocusInPlay,
  isKeyCarriedOverFromEarlierStep,
  isKeyInPlay,
  keyId,
  trackPressedKeys,
} from "./keys";
import { ALLOWED_CLASS } from "../tour/allowed";

export function requireRefresh(ctx: Context) {
  const resizeTimeout = ctx.state.__resizeTimeout;
  if (resizeTimeout) {
    window.cancelAnimationFrame(resizeTimeout);
  }

  ctx.state.__resizeTimeout = window.requestAnimationFrame(() => refreshActiveHighlight(ctx));
}

function onActiveElementResize(ctx: Context) {
  const rect = ctx.state.__activeElement?.getBoundingClientRect();
  if (!rect || (rect.width === 0 && rect.height === 0)) {
    return;
  }

  requireRefresh(ctx);
}

function trapFocus(ctx: Context, e: KeyboardEvent) {
  const isActivated = ctx.state.isInitialized;
  if (!isActivated) {
    return;
  }

  const isTabKey = e.key === "Tab" || e.keyCode === 9;
  if (!isTabKey) {
    return;
  }

  const activeElement = ctx.state.__activeElement;
  const popoverEl = ctx.state.popover?.wrapper;

  const focusableEls = [
    ...new Set(
      getFocusableElements([
        ...(popoverEl ? [popoverEl] : []),
        ...(activeElement ? [activeElement] : []),
        ...Array.from(document.querySelectorAll(`.${ALLOWED_CLASS}`)),
      ])
    ),
  ];

  const firstFocusableEl = focusableEls[0];
  const lastFocusableEl = focusableEls[focusableEls.length - 1];

  e.preventDefault();

  if (e.shiftKey) {
    const previousFocusableEl =
      focusableEls[focusableEls.indexOf(document.activeElement as HTMLElement) - 1] || lastFocusableEl;
    previousFocusableEl?.focus();
  } else {
    const nextFocusableEl =
      focusableEls[focusableEls.indexOf(document.activeElement as HTMLElement) + 1] || firstFocusableEl;
    nextFocusableEl?.focus();
  }
}

function onKeydownCapture(ctx: Context, e: KeyboardEvent) {
  handledKeys(ctx).add(keyId(e));

  if (isKeyInPlay(ctx, e.composedPath()) || isFocusInPlay(ctx)) {
    ctx.state.__widgetKey = keyId(e);
  }
}

function onKeydownBubble(ctx: Context, e: KeyboardEvent) {
  const id = keyId(e);
  if (!e.defaultPrevented && ctx.state.__widgetKey !== id) {
    handledKeys(ctx).delete(id);
  }
}

function onKeyup(ctx: Context, e: KeyboardEvent) {
  const allowKeyboardControl = ctx.config.allowKeyboardControl ?? true;
  const wasHandledByApp = handledKeys(ctx).delete(keyId(e));
  const isCarriedOver = isKeyCarriedOverFromEarlierStep(ctx, e);
  ctx.state.__pressedKeys?.delete(keyId(e));
  if (ctx.state.__widgetKey === keyId(e)) {
    ctx.state.__widgetKey = undefined;
  }

  if (!allowKeyboardControl || wasHandledByApp || isCarriedOver || isFocusInPlay(ctx)) {
    return;
  }

  if (e.key === "Escape") {
    ctx.tour.escape();
  } else if (e.key === "ArrowRight") {
    ctx.tour.arrowRight();
  } else if (e.key === "ArrowLeft") {
    ctx.tour.arrowLeft();
  }
}

export function initEvents(ctx: Context) {
  if (ctx.state.__events) {
    return;
  }

  const onWindowKeyup = (e: KeyboardEvent) => onKeyup(ctx, e);
  const onWindowKeydown = (e: KeyboardEvent) => {
    onKeydownBubble(ctx, e);
    trapFocus(ctx, e);
  };
  const onWindowKeydownCapture = (e: KeyboardEvent) => onKeydownCapture(ctx, e);
  const onWindowResize = () => requireRefresh(ctx);
  const onWindowScroll = () => requireRefresh(ctx);

  ctx.state.__events = {
    onKeyup: onWindowKeyup,
    onKeydown: onWindowKeydown,
    onKeydownCapture: onWindowKeydownCapture,
    onResize: onWindowResize,
    onScroll: onWindowScroll,
  };

  if (typeof ResizeObserver !== "undefined") {
    ctx.state.__resizeObserver = new ResizeObserver(() => onActiveElementResize(ctx));
  }

  const openObserver = new MutationObserver(() => requireRefresh(ctx));
  openObserver.observe(document.documentElement, { attributes: true, attributeFilter: ["open"], subtree: true });
  ctx.state.__openObserver = openObserver;

  const teardownGate = initGate(ctx);
  const teardownKeys = trackPressedKeys(ctx);
  ctx.state.__teardownGate = () => {
    teardownGate();
    teardownKeys();
  };
  window.addEventListener("keydown", onWindowKeydownCapture, true);
  window.addEventListener("keyup", onWindowKeyup, false);
  window.addEventListener("keydown", onWindowKeydown, false);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("scroll", onWindowScroll);
  document.addEventListener("close", onWindowResize, true);
}

export function destroyEvents(ctx: Context) {
  const events = ctx.state.__events;
  if (!events) {
    return;
  }

  window.removeEventListener("keyup", events.onKeyup);
  window.removeEventListener("keydown", events.onKeydown);
  window.removeEventListener("keydown", events.onKeydownCapture, true);
  ctx.state.__teardownGate?.();
  ctx.state.__resizeObserver?.disconnect();
  ctx.state.__openObserver?.disconnect();
  window.removeEventListener("resize", events.onResize);
  document.removeEventListener("close", events.onResize, true);
  window.removeEventListener("scroll", events.onScroll);
}

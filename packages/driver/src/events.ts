import { Context } from "./context";
import { refreshActiveHighlight } from "./highlight";
import { getFocusableElements } from "./utils";
import { handledKeys, initGate, isFocusInPlay, isKeyInPlay, keyId } from "./gate";
import { ALLOWED_CLASS } from "./allowed";

export function requireRefresh(ctx: Context) {
  const resizeTimeout = ctx.getState("__resizeTimeout");
  if (resizeTimeout) {
    window.cancelAnimationFrame(resizeTimeout);
  }

  ctx.setState(
    "__resizeTimeout",
    window.requestAnimationFrame(() => refreshActiveHighlight(ctx))
  );
}

function trapFocus(ctx: Context, e: KeyboardEvent) {
  const isActivated = ctx.getState("isInitialized");
  if (!isActivated) {
    return;
  }

  const isTabKey = e.key === "Tab" || e.keyCode === 9;
  if (!isTabKey) {
    return;
  }

  const activeElement = ctx.getState("__activeElement");
  const popoverEl = ctx.getState("popover")?.wrapper;

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
    ctx.setState("__widgetKey", keyId(e));
  }
}

function onKeydownBubble(ctx: Context, e: KeyboardEvent) {
  const id = keyId(e);
  if (!e.defaultPrevented && ctx.getState("__widgetKey") !== id) {
    handledKeys(ctx).delete(id);
  }
}

function onKeyup(ctx: Context, e: KeyboardEvent) {
  const allowKeyboardControl = ctx.getConfig("allowKeyboardControl") ?? true;
  const wasHandledByApp = handledKeys(ctx).delete(keyId(e));
  if (ctx.getState("__widgetKey") === keyId(e)) {
    ctx.setState("__widgetKey", undefined);
  }

  if (!allowKeyboardControl || wasHandledByApp || isFocusInPlay(ctx)) {
    return;
  }

  if (e.key === "Escape") {
    ctx.emit("escapePress");
  } else if (e.key === "ArrowRight") {
    ctx.emit("arrowRightPress");
  } else if (e.key === "ArrowLeft") {
    ctx.emit("arrowLeftPress");
  }
}

export function initEvents(ctx: Context) {
  if (ctx.getState("__events")) {
    return;
  }

  // Stashed in state so destroyEvents can detach these exact references.
  const onWindowKeyup = (e: KeyboardEvent) => onKeyup(ctx, e);
  const onWindowKeydown = (e: KeyboardEvent) => {
    onKeydownBubble(ctx, e);
    trapFocus(ctx, e);
  };
  const onWindowKeydownCapture = (e: KeyboardEvent) => onKeydownCapture(ctx, e);
  const onWindowResize = () => requireRefresh(ctx);
  const onWindowScroll = () => requireRefresh(ctx);

  ctx.setState("__events", {
    onKeyup: onWindowKeyup,
    onKeydown: onWindowKeydown,
    onKeydownCapture: onWindowKeydownCapture,
    onResize: onWindowResize,
    onScroll: onWindowScroll,
  });

  ctx.setState("__teardownGate", initGate(ctx));
  window.addEventListener("keydown", onWindowKeydownCapture, true);
  window.addEventListener("keyup", onWindowKeyup, false);
  window.addEventListener("keydown", onWindowKeydown, false);
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("scroll", onWindowScroll);
}

export function destroyEvents(ctx: Context) {
  const events = ctx.getState("__events");
  if (!events) {
    return;
  }

  window.removeEventListener("keyup", events.onKeyup);
  window.removeEventListener("keydown", events.onKeydown);
  window.removeEventListener("keydown", events.onKeydownCapture, true);
  ctx.getState("__teardownGate")?.();
  window.removeEventListener("resize", events.onResize);
  window.removeEventListener("scroll", events.onScroll);
}

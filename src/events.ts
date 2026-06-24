import { refreshActiveHighlight } from "./highlight";
import { emit } from "./emitter";
import { getState, setState } from "./state";
import { getConfig } from "./config";
import { getFocusableElements } from "./utils";

export function requireRefresh() {
  const resizeTimeout = getState("__resizeTimeout");
  if (resizeTimeout) {
    window.cancelAnimationFrame(resizeTimeout);
  }

  setState("__resizeTimeout", window.requestAnimationFrame(refreshActiveHighlight));
}

function trapFocus(e: KeyboardEvent) {
  const isActivated = getState("isInitialized");
  if (!isActivated) {
    return;
  }

  const isTabKey = e.key === "Tab" || e.keyCode === 9;
  if (!isTabKey) {
    return;
  }

  const activeElement = getState("__activeElement");
  const popoverEl = getState("popover")?.wrapper;

  const focusableEls = getFocusableElements([
    ...(popoverEl ? [popoverEl] : []),
    ...(activeElement ? [activeElement] : []),
  ]);

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

function onKeyup(e: KeyboardEvent) {
  const allowKeyboardControl = getConfig("allowKeyboardControl") ?? true;

  if (!allowKeyboardControl) {
    return;
  }

  if (e.key === "Escape") {
    emit("escapePress");
  } else if (e.key === "ArrowRight") {
    emit("arrowRightPress");
  } else if (e.key === "ArrowLeft") {
    emit("arrowLeftPress");
  }
}

// The pointer events we intercept to make sure no external library ever hears
// about a click before driver.js does. `click` carries the actual handler; the
// rest are only suppressed.
const DRIVER_CLICK_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;

// Associates each driver element with the single document-level handler that
// was registered on its behalf, so it can be removed when the element is torn
// down. A WeakMap keyed by the element avoids leaking handlers onto `document`
// (the popover is rebuilt every step) and needs no id bookkeeping on the DOM.
const driverClickHandlers = new WeakMap<Element, (e: MouseEvent | PointerEvent) => void>();

/**
 * Attaches click handler to the elements created by driver.js. It makes
 * sure to give the listener the first chance to handle the event, and
 * prevents all other pointer-events to make sure no external-library
 * ever knows the click happened.
 *
 * @param {Element} element Element to listen for click events
 * @param {(pointer: MouseEvent | PointerEvent) => void} listener Click handler
 * @param {(target: HTMLElement) => boolean} shouldPreventDefault Whether to prevent default action i.e. link clicks etc
 */
export function onDriverClick(
  element: Element,
  listener: (pointer: MouseEvent | PointerEvent) => void,
  shouldPreventDefault?: (target: HTMLElement) => boolean
) {
  // Defensive: if this element somehow already has a handler attached, remove
  // it first so we never register duplicates.
  destroyDriverClick(element);

  const handler = (e: MouseEvent | PointerEvent) => {
    const target = e.target as HTMLElement;
    if (!element.contains(target)) {
      return;
    }

    if (!shouldPreventDefault || shouldPreventDefault(target)) {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    }

    // Only the actual click should invoke the user's listener; the other
    // events exist purely to suppress interaction beneath the overlay/popover.
    if (e.type === "click") {
      listener?.(e);
    }
  };

  // We want to be the absolute first one to hear about the event
  const useCapture = true;

  for (const type of DRIVER_CLICK_EVENTS) {
    document.addEventListener(type, handler, useCapture);
  }

  driverClickHandlers.set(element, handler);
}

export function destroyDriverClick(element: Element) {
  const handler = driverClickHandlers.get(element);
  if (!handler) {
    return;
  }

  for (const type of DRIVER_CLICK_EVENTS) {
    document.removeEventListener(type, handler, true);
  }

  driverClickHandlers.delete(element);
}

export function initEvents() {
  window.addEventListener("keyup", onKeyup, false);
  window.addEventListener("keydown", trapFocus, false);
  window.addEventListener("resize", requireRefresh);
  window.addEventListener("scroll", requireRefresh);
}

export function destroyEvents() {
  window.removeEventListener("keyup", onKeyup);
  window.removeEventListener("keydown", trapFocus);
  window.removeEventListener("resize", requireRefresh);
  window.removeEventListener("scroll", requireRefresh);
}

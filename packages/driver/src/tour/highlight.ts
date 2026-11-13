import { Context } from "../core/context";
import type { DriveStep } from "../types";
import { refreshOverlay, trackActiveElement, transitionStage } from "../overlay/overlay";
import { beginTransition, endTransition, isTransitioning, missRefresh, ownsTransition } from "./lifecycle";
import { reboundElement, startTransfer } from "./transfer";
import { stepOption } from "../core/options";
import { hidePopover } from "../popover/popover";
import { renderStepPopover, repositionStepPopover } from "./step";
import {
  bringInView,
  DUMMY_ELEMENT_ID,
  isDummyElement,
  isInsideAllowedElement,
  isScrollable,
  moveToLayerOf,
  RAISED_CLASS,
  resolveElement,
} from "../core/utils";

const POPOVER_ARIA: Record<string, string> = {
  "aria-haspopup": "dialog",
  "aria-expanded": "true",
  "aria-controls": "driver-popover-content",
};

const driverAria = new WeakSet<Element>();

function setPopoverAria(element: Element) {
  const isAppOwned = Object.keys(POPOVER_ARIA).some(name => element.hasAttribute(name));
  if (isAppOwned && !driverAria.has(element)) {
    return;
  }

  for (const [name, value] of Object.entries(POPOVER_ARIA)) {
    element.setAttribute(name, value);
  }
  driverAria.add(element);
}

function restoreAria(element: Element) {
  if (!driverAria.has(element)) {
    return;
  }

  for (const [name, value] of Object.entries(POPOVER_ARIA)) {
    if (element.getAttribute(name) === value) {
      element.removeAttribute(name);
    }
  }

  driverAria.delete(element);
}

export function mountDummyElement(): Element {
  const existingDummy = document.getElementById(DUMMY_ELEMENT_ID);
  if (existingDummy) {
    return existingDummy;
  }

  const element = document.createElement("div");

  element.id = DUMMY_ELEMENT_ID;
  element.style.cssText = "width:0;height:0;pointer-events:none;opacity:0;position:fixed;top:50%;left:50%";

  document.body.appendChild(element);

  return element;
}

export function highlight(ctx: Context, step: DriveStep) {
  let elemObj = resolveElement(step.element);

  if (!elemObj) {
    elemObj = mountDummyElement();
  }

  transferHighlight(ctx, elemObj, step);
}

function observeSize(ctx: Context, element?: Element) {
  const observer = ctx.state.__resizeObserver;
  observer?.disconnect();
  if (element) {
    observer?.observe(element);
  }
}

export function refreshActiveHighlight(ctx: Context) {
  const activeHighlight = ctx.state.__activeElement;
  const activeStep = ctx.state.__activeStep;

  if (!activeHighlight || !activeStep) {
    return;
  }

  if (isTransitioning(ctx)) {
    missRefresh(ctx);
    refreshOverlay(ctx);
    return;
  }

  ctx.state.__syncAllowedElements?.();
  followLayer(ctx, activeHighlight);
  trackActiveElement(ctx, activeHighlight);
  refreshOverlay(ctx);
  repositionStepPopover(ctx, activeHighlight, activeStep);
}

function followLayer(ctx: Context, element: Element) {
  const wrapper = ctx.state.popover?.wrapper;
  if (wrapper) {
    moveToLayerOf(wrapper, element);
  }
}

function transferHighlight(ctx: Context, toElement: Element, toStep: DriveStep) {
  observeSize(ctx);
  const duration = ctx.config.duration || 400;
  const start = Date.now();
  const isAnimatedTour = ctx.config.animate;

  const commitTransfer = startTransfer(ctx, toElement, toStep);
  if (!commitTransfer) {
    return;
  }

  const fromElement = ctx.state.previousElement || toElement;
  const isFirstHighlight = fromElement === toElement;
  const hasDelayedPopover = !isFirstHighlight && isAnimatedTour;
  let isPopoverRendered = false;

  hidePopover(ctx.state.popover);

  const animate = () => {
    if (!ownsTransition(ctx, animate)) {
      return;
    }

    const elapsed = Date.now() - start;
    const timeRemaining = duration - elapsed;
    const isHalfwayThrough = timeRemaining <= duration / 2;
    const targetElement = reboundElement(ctx, toStep, toElement);

    if (toStep.popover && isHalfwayThrough && !isPopoverRendered && hasDelayedPopover) {
      renderStepPopover(ctx, targetElement, toStep);
      isPopoverRendered = true;
    }

    if (ctx.config.animate && elapsed < duration) {
      transitionStage(ctx, elapsed, duration, fromElement, targetElement);
    } else {
      trackActiveElement(ctx, targetElement);

      commitTransfer(targetElement);

      if (!ownsTransition(ctx, animate)) {
        return;
      }

      const hasMissedRefresh = endTransition(ctx);
      observeSize(ctx, targetElement);
      if (hasMissedRefresh) {
        refreshActiveHighlight(ctx);
      }

      return;
    }

    window.requestAnimationFrame(animate);
  };

  beginTransition(ctx, animate);

  window.requestAnimationFrame(animate);

  clearParentMarks(ctx);

  if (stepOption(ctx, toStep, "scrollIntoView") !== false) {
    bringInView(toElement, ctx.config.smoothScroll);
  }
  if (!hasDelayedPopover && toStep.popover) {
    renderStepPopover(ctx, toElement, toStep);
  }

  clearElementMarks(ctx);
  markActiveElement(ctx, toElement, toStep);
}

const classGuards = new WeakMap<Element, MutationObserver>();

function guardClasses(element: Element, classesToKeep: () => string[]) {
  classGuards.get(element)?.disconnect();

  const observer = new MutationObserver(() => {
    const missing = classesToKeep().filter(name => !element.classList.contains(name));
    if (missing.length > 0) {
      element.classList.add(...missing);
    }
  });
  observer.observe(element, { attributes: true, attributeFilter: ["class"] });
  classGuards.set(element, observer);
}

function clearActiveElement(element: Element) {
  classGuards.get(element)?.disconnect();
  classGuards.delete(element);
  element.classList.remove("driver-active-element", "driver-no-interaction", RAISED_CLASS);
  restoreAria(element);
}

function clearElementMarks(ctx: Context) {
  const marked = ctx.state.__marked?.element;
  new Set([marked, ...document.querySelectorAll(".driver-active-element")]).forEach(element => {
    if (element) {
      clearActiveElement(element);
    }
  });
}

function clearParentMarks(ctx: Context) {
  const marked = ctx.state.__marked?.parent;
  new Set([marked, ...document.querySelectorAll(".driver-active-element-parent")]).forEach(parent => {
    parent?.classList.remove("driver-active-element-parent", "driver-active-element-parent-no-scroll");
  });
}

function markActiveElement(ctx: Context, element: Element, step: DriveStep) {
  const isBlocked = stepOption(ctx, step, "disableActiveInteraction") === true;
  if (isBlocked) {
    element.classList.add("driver-no-interaction");
  }

  const parent = element.parentElement;
  const markedParent = parent && parent !== document.body ? parent : undefined;
  if (markedParent) {
    markedParent.classList.add("driver-active-element-parent");

    if (isScrollable(markedParent)) {
      markedParent.classList.add("driver-active-element-parent-no-scroll");
    }
  }

  ctx.state.__marked = { element, parent: markedParent };
  element.classList.add("driver-active-element");
  if (!isDummyElement(element)) {
    setPopoverAria(element);
    element.classList.toggle(RAISED_CLASS, isInsideAllowedElement(element));
    guardClasses(element, () => [
      "driver-active-element",
      ...(isBlocked ? ["driver-no-interaction"] : []),
      ...(isInsideAllowedElement(element) ? [RAISED_CLASS] : []),
    ]);
  }
}

export function removeDummyElement() {
  document.getElementById(DUMMY_ELEMENT_ID)?.remove();
}

export function destroyHighlight(ctx: Context) {
  removeDummyElement();
  clearParentMarks(ctx);
  clearElementMarks(ctx);
}

export function rebindActiveElement(ctx: Context, element: Element) {
  const step = ctx.state.activeStep;
  if (!step) {
    return;
  }

  clearParentMarks(ctx);
  clearElementMarks(ctx);
  markActiveElement(ctx, element, step);

  ctx.state.activeElement = element;
  ctx.state.__activeElement = element;
  observeSize(ctx, element);

  followLayer(ctx, element);
  trackActiveElement(ctx, element);
  repositionStepPopover(ctx, element, step);
}

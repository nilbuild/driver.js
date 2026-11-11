import { Context } from "../core/context";
import type { DriveStep } from "../types";
import { refreshOverlay, trackActiveElement, transitionStage } from "../overlay/overlay";
import { beginTransition, endTransition, isCurrent, isTransitioning, missRefresh, ownsTransition } from "./lifecycle";
import { stepOption } from "../core/options";
import { hidePopover } from "../popover/popover";
import { renderStepPopover, repositionStepPopover } from "./step";
import {
  bringInView,
  DUMMY_ELEMENT_ID,
  isDummyElement,
  isScrollable,
  moveToLayerOf,
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
  const observer = ctx.getState("__resizeObserver");
  observer?.disconnect();
  if (element) {
    observer?.observe(element);
  }
}

export function refreshActiveHighlight(ctx: Context) {
  const activeHighlight = ctx.getState("__activeElement");
  const activeStep = ctx.getState("__activeStep");

  if (!activeHighlight || !activeStep) {
    return;
  }

  if (isTransitioning(ctx)) {
    missRefresh(ctx);
    refreshOverlay(ctx);
    return;
  }

  ctx.getState("__syncAllowedElements")?.();
  followLayer(ctx, activeHighlight);
  trackActiveElement(ctx, activeHighlight);
  refreshOverlay(ctx);
  repositionStepPopover(ctx, activeHighlight, activeStep);
}

function followLayer(ctx: Context, element: Element) {
  const wrapper = ctx.getState("popover")?.wrapper;
  if (wrapper) {
    moveToLayerOf(wrapper, element);
  }
}

function transferHighlight(ctx: Context, toElement: Element, toStep: DriveStep) {
  const activation = ctx.getState("__activation");
  const isSuperseded = () => !isCurrent(ctx, activation);

  observeSize(ctx);
  const duration = ctx.getConfig("duration") || 400;
  const start = Date.now();

  const fromStep = ctx.getState("__activeStep");
  const fromElement = ctx.getState("__activeElement") || toElement;

  const isFirstHighlight = !fromElement || fromElement === toElement;
  const isToDummyElement = isDummyElement(toElement);
  const isFromDummyElement = isDummyElement(fromElement);

  const isAnimatedTour = ctx.getConfig("animate");
  const highlightStartedHook = toStep.onHighlightStarted || ctx.getConfig("onHighlightStarted");
  const highlightedHook = toStep.onHighlighted || ctx.getConfig("onHighlighted");
  const deselectedHook = fromStep?.onDeselected || ctx.getConfig("onDeselected");
  const signal = activation?.controller.signal;

  const hookOpts = ctx.getHookOpts();

  if (fromStep && fromStep !== toStep && deselectedHook) {
    deselectedHook(isFromDummyElement ? undefined : fromElement, fromStep, hookOpts);
    if (isSuperseded()) {
      return;
    }
  }

  if (highlightStartedHook) {
    highlightStartedHook(isToDummyElement ? undefined : toElement, toStep, { ...hookOpts, signal });
    if (isSuperseded()) {
      return;
    }
  }

  const hasDelayedPopover = !isFirstHighlight && isAnimatedTour;
  let isPopoverRendered = false;

  hidePopover(ctx.getState("popover"));

  ctx.setState("previousStep", fromStep);
  ctx.setState("previousElement", fromElement);
  ctx.setState("activeStep", toStep);
  ctx.setState("activeElement", toElement);

  const commitBeforeHighlightedHook = (targetElement: Element) => {
    ctx.setState("__previousStep", fromStep);
    ctx.setState("__previousElement", fromElement);
    ctx.setState("__activeStep", toStep);
    ctx.setState("__activeElement", targetElement);
  };

  const animate = () => {
    if (!ownsTransition(ctx, animate)) {
      return;
    }

    const elapsed = Date.now() - start;
    const timeRemaining = duration - elapsed;
    const isHalfwayThrough = timeRemaining <= duration / 2;
    const reboundElement = ctx.getState("activeStep") === toStep ? ctx.getState("activeElement") : undefined;
    const targetElement = reboundElement || toElement;

    if (toStep.popover && isHalfwayThrough && !isPopoverRendered && hasDelayedPopover) {
      renderStepPopover(ctx, targetElement, toStep);
      isPopoverRendered = true;
    }

    if (ctx.getConfig("animate") && elapsed < duration) {
      transitionStage(ctx, elapsed, duration, fromElement, targetElement);
    } else {
      trackActiveElement(ctx, targetElement);

      commitBeforeHighlightedHook(targetElement);

      if (highlightedHook) {
        highlightedHook(isToDummyElement ? undefined : targetElement, toStep, { ...ctx.getHookOpts(), signal });
      }

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

  bringInView(toElement, ctx.getConfig("smoothScroll"));
  if (!hasDelayedPopover && toStep.popover) {
    renderStepPopover(ctx, toElement, toStep);
  }

  clearElementMarks(ctx);
  markActiveElement(ctx, toElement, toStep);
}

const classGuards = new WeakMap<Element, MutationObserver>();

function guardClasses(element: Element, classes: string[]) {
  classGuards.get(element)?.disconnect();

  const observer = new MutationObserver(() => {
    const missing = classes.filter(name => !element.classList.contains(name));
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
  element.classList.remove("driver-active-element", "driver-no-interaction");
  restoreAria(element);
}

function clearElementMarks(ctx: Context) {
  const marked = ctx.getState("__marked")?.element;
  new Set([marked, ...document.querySelectorAll(".driver-active-element")]).forEach(element => {
    if (element) {
      clearActiveElement(element);
    }
  });
}

function clearParentMarks(ctx: Context) {
  const marked = ctx.getState("__marked")?.parent;
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

  ctx.setState("__marked", { element, parent: markedParent });
  element.classList.add("driver-active-element");
  if (!isDummyElement(element)) {
    setPopoverAria(element);
    guardClasses(element, isBlocked ? ["driver-active-element", "driver-no-interaction"] : ["driver-active-element"]);
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
  const step = ctx.getState("activeStep");
  if (!step) {
    return;
  }

  clearParentMarks(ctx);
  clearElementMarks(ctx);
  markActiveElement(ctx, element, step);

  ctx.setState("activeElement", element);
  ctx.setState("__activeElement", element);
  observeSize(ctx, element);

  followLayer(ctx, element);
  trackActiveElement(ctx, element);
  repositionStepPopover(ctx, element, step);
}

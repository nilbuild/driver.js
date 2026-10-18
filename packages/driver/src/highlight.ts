import { Context } from "./context";
import { DriveStep } from "./driver";
import { refreshOverlay, trackActiveElement, transitionStage } from "./overlay";
import { hidePopover } from "./popover";
import { renderStepPopover, repositionStepPopover } from "./step";
import { bringInView, isScrollable, resolveElement } from "./utils";

const POPOVER_ARIA: Record<string, string> = {
  "aria-haspopup": "dialog",
  "aria-expanded": "true",
  "aria-controls": "driver-popover-content",
};

const originalAria = new WeakMap<Element, Record<string, string | null>>();

function setPopoverAria(element: Element) {
  if (!originalAria.has(element)) {
    const original = Object.fromEntries(Object.keys(POPOVER_ARIA).map(name => [name, element.getAttribute(name)]));
    originalAria.set(element, original);
  }

  for (const [name, value] of Object.entries(POPOVER_ARIA)) {
    element.setAttribute(name, value);
  }
}

function restoreAria(element: Element) {
  const original = originalAria.get(element);
  if (!original) {
    return;
  }

  for (const [name, value] of Object.entries(original)) {
    if (value === null) {
      element.removeAttribute(name);
    } else {
      element.setAttribute(name, value);
    }
  }

  originalAria.delete(element);
}

function mountDummyElement(): Element {
  const existingDummy = document.getElementById("driver-dummy-element");
  if (existingDummy) {
    return existingDummy;
  }

  let element = document.createElement("div");

  element.id = "driver-dummy-element";
  element.style.width = "0";
  element.style.height = "0";
  element.style.pointerEvents = "none";
  element.style.opacity = "0";
  element.style.position = "fixed";
  element.style.top = "50%";
  element.style.left = "50%";

  document.body.appendChild(element);

  return element;
}

export function highlight(ctx: Context, step: DriveStep) {
  let elemObj = resolveElement(step.element);

  // If the element is not found, we mount a 1px div
  // at the center of the screen to highlight and show
  // the popover on top of that. This is to show a
  // modal-like highlight.
  if (!elemObj) {
    elemObj = mountDummyElement();
  }

  transferHighlight(ctx, elemObj, step);
}

export function refreshActiveHighlight(ctx: Context) {
  const activeHighlight = ctx.getState("__activeElement");
  const activeStep = ctx.getState("__activeStep")!;

  if (!activeHighlight) {
    return;
  }

  trackActiveElement(ctx, activeHighlight);
  refreshOverlay(ctx);
  repositionStepPopover(ctx, activeHighlight, activeStep);
}

function transferHighlight(ctx: Context, toElement: Element, toStep: DriveStep) {
  const duration = ctx.getConfig("duration") || 400;
  const start = Date.now();

  const fromStep = ctx.getState("__activeStep");
  const fromElement = ctx.getState("__activeElement") || toElement;

  // If it's the first time we're highlighting an element, we show
  // the popover immediately. Otherwise, we wait for the animation
  // to finish before showing the popover.
  const isFirstHighlight = !fromElement || fromElement === toElement;
  const isToDummyElement = toElement.id === "driver-dummy-element";
  const isFromDummyElement = fromElement.id === "driver-dummy-element";

  const isAnimatedTour = ctx.getConfig("animate");
  const highlightStartedHook = toStep.onHighlightStarted || ctx.getConfig("onHighlightStarted");
  const highlightedHook = toStep?.onHighlighted || ctx.getConfig("onHighlighted");
  const deselectedHook = fromStep?.onDeselected || ctx.getConfig("onDeselected");

  const hookOpts = ctx.getHookOpts();

  if (fromStep && fromStep !== toStep && deselectedHook) {
    deselectedHook(isFromDummyElement ? undefined : fromElement, fromStep, hookOpts);
  }

  if (highlightStartedHook) {
    highlightStartedHook(isToDummyElement ? undefined : toElement, toStep, hookOpts);
  }

  const hasDelayedPopover = !isFirstHighlight && isAnimatedTour;
  let isPopoverRendered = false;

  hidePopover(ctx.getState("popover"));

  ctx.setState("previousStep", fromStep);
  ctx.setState("previousElement", fromElement);
  ctx.setState("activeStep", toStep);
  ctx.setState("activeElement", toElement);

  const animate = () => {
    const transitionCallback = ctx.getState("__transitionCallback");

    // This makes sure that the repeated calls to transferHighlight
    // don't interfere with each other. Only the last call will be
    // executed.
    if (transitionCallback !== animate) {
      return;
    }

    const elapsed = Date.now() - start;
    const timeRemaining = duration - elapsed;
    const isHalfwayThrough = timeRemaining <= duration / 2;

    if (toStep.popover && isHalfwayThrough && !isPopoverRendered && hasDelayedPopover) {
      renderStepPopover(ctx, toElement, toStep);
      isPopoverRendered = true;
    }

    if (ctx.getConfig("animate") && elapsed < duration) {
      transitionStage(ctx, elapsed, duration, fromElement, toElement);
    } else {
      trackActiveElement(ctx, toElement);

      if (highlightedHook) {
        highlightedHook(isToDummyElement ? undefined : toElement, toStep, ctx.getHookOpts());
      }

      ctx.setState("__transitionCallback", undefined);
      ctx.setState("__previousStep", fromStep);
      ctx.setState("__previousElement", fromElement);
      ctx.setState("__activeStep", toStep);
      ctx.setState("__activeElement", toElement);
    }

    window.requestAnimationFrame(animate);
  };

  ctx.setState("__transitionCallback", animate);

  window.requestAnimationFrame(animate);

  document.querySelectorAll(".driver-active-element-parent").forEach(element => {
    element.classList.remove("driver-active-element-parent", "driver-active-element-parent-no-scroll");
  });

  bringInView(toElement, ctx.getConfig("smoothScroll"));
  if (!hasDelayedPopover && toStep.popover) {
    renderStepPopover(ctx, toElement, toStep);
  }

  document.querySelectorAll(".driver-active-element").forEach(element => {
    element.classList.remove("driver-active-element", "driver-no-interaction");
    restoreAria(element);
  });

  const disableActiveInteraction = toStep.disableActiveInteraction ?? ctx.getConfig("disableActiveInteraction");
  if (disableActiveInteraction) {
    toElement.classList.add("driver-no-interaction");
  }

  const toParent = toElement.parentElement;
  if (toParent && toParent !== document.body) {
    toParent.classList.add("driver-active-element-parent");

    if (isScrollable(toParent)) {
      toParent.classList.add("driver-active-element-parent-no-scroll");
    }
  }

  toElement.classList.add("driver-active-element");
  setPopoverAria(toElement);
}

export function destroyHighlight() {
  document.getElementById("driver-dummy-element")?.remove();
  document.querySelectorAll(".driver-active-element").forEach(element => {
    const parent = element.parentElement;
    if (parent && parent !== document.body) {
      parent.classList.remove("driver-active-element-parent", "driver-active-element-parent-no-scroll");
    }

    element.classList.remove("driver-active-element", "driver-no-interaction");
    restoreAria(element);
  });
}

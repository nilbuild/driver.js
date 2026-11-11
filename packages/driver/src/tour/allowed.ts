import type { AllowedElements, Context } from "../core/context";
import type { DriveStep } from "../types";
import { redrawOverlay } from "../overlay/overlay";
import { stepOption } from "../core/options";
import { ALLOWED_CLASS, isDummyElement, isInsideAllowedElement, RAISED_CLASS } from "../core/utils";

export { ALLOWED_CLASS };

const DRIVER_UI = ".driver-layer, .driver-overlay, .driver-popover";

export function resolveAllowedSetting(ctx: Context, step: DriveStep): AllowedElements | undefined {
  return stepOption(ctx, step, "allowedElements");
}

export function resolveAllowedElements(setting: AllowedElements | undefined): Element[] {
  if (!setting) {
    return [];
  }

  if (typeof setting === "function") {
    return Array.from(setting() || []);
  }

  const entries = Array.isArray(setting) ? setting : [setting];

  return entries.flatMap(entry => {
    if (typeof entry === "string") {
      return Array.from(document.querySelectorAll(entry));
    }

    return entry ? [entry] : [];
  });
}

export function trackAllowedElements(ctx: Context, step: DriveStep, signal: AbortSignal) {
  const setting = resolveAllowedSetting(ctx, step);
  if (!setting) {
    return;
  }

  let marked = new Set<Element>();
  let frame: number | undefined;

  const sync = () => {
    if (signal.aborted) {
      return;
    }

    const matches = new Set(resolveAllowedElements(setting));
    marked.forEach(element => {
      if (!matches.has(element) && element.classList.contains(ALLOWED_CLASS)) {
        element.classList.remove(ALLOWED_CLASS);
      }
    });
    matches.forEach(element => {
      if (!element.classList.contains(ALLOWED_CLASS)) {
        element.classList.add(ALLOWED_CLASS);
      }
    });
    marked = matches;

    const active = ctx.getState("activeElement");
    const isRaised = !!active && !isDummyElement(active) && isInsideAllowedElement(active);
    if (active && isRaised !== active.classList.contains(RAISED_CLASS)) {
      active.classList.toggle(RAISED_CLASS, isRaised);
      redrawOverlay(ctx, true);
    }
  };

  const schedule = () => {
    if (frame !== undefined) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      sync();
      redrawOverlay(ctx);
    });
  };

  const observer = new MutationObserver(records => {
    let isRelevant = false;
    records.forEach(record => {
      const target = record.target as Element;
      if (target.closest?.(DRIVER_UI)) {
        return;
      }

      isRelevant = true;
      if (record.attributeName === "class" && marked.has(target) && !target.classList.contains(ALLOWED_CLASS)) {
        target.classList.add(ALLOWED_CLASS);
      }
    });

    if (isRelevant) {
      schedule();
    }
  });

  const isLookup = typeof setting === "function" || [setting].flat().some(entry => typeof entry === "string");

  sync();
  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    ...(isLookup ? {} : { attributeFilter: ["class"] }),
  });
  ctx.setState("__syncAllowedElements", sync);

  signal.addEventListener("abort", () => {
    observer.disconnect();
    if (frame !== undefined) {
      window.cancelAnimationFrame(frame);
    }

    marked.forEach(element => element.classList.remove(ALLOWED_CLASS));
    if (ctx.getState("__syncAllowedElements") === sync) {
      ctx.setState("__syncAllowedElements", undefined);
    }
  });
}

export function isFocusWithinStep(ctx: Context, element: Element, step: DriveStep): boolean {
  const focused = document.activeElement;
  if (!focused || focused === document.body) {
    return false;
  }

  const isInteractive = stepOption(ctx, step, "disableActiveInteraction") !== true;
  if (!isDummyElement(element) && isInteractive && element.contains(focused)) {
    return true;
  }

  return resolveAllowedElements(resolveAllowedSetting(ctx, step)).some(allowed => allowed.contains(focused));
}

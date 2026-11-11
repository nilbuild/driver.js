import type { AllowedElements, Context } from "../core/context";
import type { DriveStep } from "../types";
import { redrawOverlayCutouts } from "../overlay/overlay";
import { stepOption } from "../core/options";
import { isDummyElement } from "../core/utils";

export const ALLOWED_CLASS = "driver-allowed-element";

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
  };

  const schedule = () => {
    if (frame !== undefined) {
      return;
    }

    frame = window.requestAnimationFrame(() => {
      frame = undefined;
      sync();
      redrawOverlayCutouts(ctx);
    });
  };

  const observer = new MutationObserver(() => {
    marked.forEach(element => {
      if (!element.classList.contains(ALLOWED_CLASS)) {
        element.classList.add(ALLOWED_CLASS);
      }
    });
    schedule();
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

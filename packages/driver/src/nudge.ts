import type { Context } from "./context";
import { isDummyElement } from "./utils";
import { mountNudgeRing } from "./overlay";

export type NudgeTarget = "popover" | "element" | "both";

const POPOVER_CLASS = "driver-popover-nudge";
const timers = new WeakMap<Element, number>();

function nudgeDuration(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue("--driver-nudge-duration").trim();
  const value = parseFloat(raw);
  if (Number.isNaN(value)) {
    return 500;
  }

  return raw.endsWith("ms") || !raw.endsWith("s") ? value : value * 1000;
}

function untilAnimationEnds(element: Element, onEnd: () => void) {
  window.clearTimeout(timers.get(element));

  const finish = () => {
    window.clearTimeout(timers.get(element));
    timers.delete(element);
    element.removeEventListener("animationend", onAnimationEnd);
    onEnd();
  };

  const onAnimationEnd = (event: Event) => {
    const name = (event as AnimationEvent).animationName;
    if (name && !name.startsWith("driver-nudge")) {
      return;
    }

    finish();
  };

  element.addEventListener("animationend", onAnimationEnd);
  timers.set(element, window.setTimeout(finish, nudgeDuration() + 150));
}

function nudgePopover(ctx: Context) {
  const wrapper = ctx.getState("popover")?.wrapper;
  if (!wrapper || !wrapper.isConnected || wrapper.style.display === "none") {
    return;
  }

  wrapper.classList.remove(POPOVER_CLASS);
  void wrapper.offsetWidth;
  wrapper.classList.add(POPOVER_CLASS);
  untilAnimationEnds(wrapper, () => wrapper.classList.remove(POPOVER_CLASS));
}

function nudgeElement(ctx: Context) {
  if (isDummyElement(ctx.getState("activeElement"))) {
    return;
  }

  const ring = mountNudgeRing(ctx);
  if (ring) {
    untilAnimationEnds(ring, () => ring.remove());
  }
}

export function nudge(ctx: Context, target: NudgeTarget = "both") {
  if (!ctx.getState("isInitialized")) {
    return;
  }

  if (target !== "element") {
    nudgePopover(ctx);
  }

  if (target !== "popover") {
    nudgeElement(ctx);
  }
}

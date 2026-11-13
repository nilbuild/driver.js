import type { Context } from "../core/context";

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

function restartAnimation(wrapper: HTMLElement) {
  wrapper.classList.remove(POPOVER_CLASS);
  void wrapper.offsetWidth;
  wrapper.classList.add(POPOVER_CLASS);
}

export function nudge(ctx: Context) {
  const wrapper = ctx.state.popover?.wrapper;
  if (!ctx.state.isInitialized || !wrapper || !wrapper.isConnected || wrapper.style.display === "none") {
    return;
  }

  restartAnimation(wrapper);
  untilAnimationEnds(wrapper, () => wrapper.classList.remove(POPOVER_CLASS));
}

import { hookOpts } from "../core/context";
import type { Context } from "../core/context";
import { elementBlockOf, GATED_EVENTS } from "./gesture";
import { stepOption } from "../core/options";
import { regionOf } from "./region";
import { isActionStep } from "../tour/step";
import { isDummyElement } from "../core/utils";
import { isUserEvent } from "./trust";

const PRESS_EVENTS = ["pointerdown", "mousedown", "touchstart"] as const;
const RELEASE_EVENTS = ["pointerup", "mouseup", "touchend"] as const;
const TOUCH_EVENTS = new Set<string>(["touchstart", "touchend"]);
const CANCELED_EVENTS = new Set<string>(["pointerdown", "mousedown", "pointerup", "mouseup", "click"]);

function consume(ctx: Context, event: Event) {
  event.preventDefault();
  event.stopImmediatePropagation();
  ctx.consumed.add(event);
}

type DeadHit = "root" | "overlay";

function deadHitOf(ctx: Context, event: Event): DeadHit | undefined {
  if (!ctx.ui.blocksInteraction) {
    return undefined;
  }

  const path = event.composedPath();
  if (regionOf(ctx, path) !== "outside") {
    return undefined;
  }

  const target = path[0];
  if (target === document.body || target === document.documentElement) {
    return "root";
  }

  const overlay = ctx.state.__overlaySvg;
  if (overlay && path.includes(overlay)) {
    return "overlay";
  }

  return undefined;
}

function swallow(event: Event) {
  if (CANCELED_EVENTS.has(event.type)) {
    event.preventDefault();
  }

  event.stopImmediatePropagation();
}

function onGatedEvent(ctx: Context, event: MouseEvent) {
  if (!ctx.state.isInitialized) {
    return;
  }

  const step = ctx.state.activeStep;
  const onInteraction = stepOption(ctx, step, "onInteraction");
  if (!step || !onInteraction) {
    return;
  }

  if (event.type === "auxclick" && event.button === 2) {
    return;
  }

  const region = regionOf(ctx, event.composedPath());
  if (region === "popover") {
    return;
  }

  const element = ctx.state.activeElement;
  const result = onInteraction(isDummyElement(element) ? undefined : element, step, {
    ...hookOpts(ctx),
    event,
    region,
  });

  if (result === false) {
    consume(ctx, event);
  }
}

export function initGate(ctx: Context): () => void {
  const controller = new AbortController();

  let isDeadPress = false;

  const onPress = (event: Event) => {
    if (!ctx.state.isInitialized || !isUserEvent(event)) {
      return;
    }

    isDeadPress = !!deadHitOf(ctx, event);
    if (isDeadPress || elementBlockOf(ctx, event)) {
      swallow(event);
    }
  };

  const onRelease = (event: Event) => {
    if (!ctx.state.isInitialized || !isUserEvent(event)) {
      return;
    }

    if ((isDeadPress && deadHitOf(ctx, event)) || elementBlockOf(ctx, event)) {
      swallow(event);
    }
  };

  const onGated = (event: Event) => {
    onGatedEvent(ctx, event as MouseEvent);
    if (!ctx.state.isInitialized || ctx.consumed.has(event) || !isUserEvent(event)) {
      return;
    }

    const isSecondEnd = event.type === "dblclick" || (event.type === "auxclick" && (event as MouseEvent).button === 2);

    if (isDeadPress && deadHitOf(ctx, event) === "root") {
      swallow(event);
      if (isActionStep(ctx.state.activeStep) && !isSecondEnd) {
        ctx.ui.nudge(ctx);
      }

      return;
    }

    const block = elementBlockOf(ctx, event);
    if (!block) {
      return;
    }

    consume(ctx, event);
    if (block === "strict" && !isSecondEnd) {
      ctx.ui.nudge(ctx);
    }
  };

  const listen = (type: string, listener: (event: Event) => void) => {
    window.addEventListener(type, listener, {
      capture: true,
      passive: TOUCH_EVENTS.has(type) || undefined,
      signal: controller.signal,
    });
  };

  PRESS_EVENTS.forEach(type => listen(type, onPress));
  RELEASE_EVENTS.forEach(type => listen(type, onRelease));
  GATED_EVENTS.forEach(type => listen(type, onGated));

  return () => controller.abort();
}

const DRIVER_CLICK_EVENTS = ["pointerdown", "mousedown", "pointerup", "mouseup", "click"] as const;

const driverClickHandlers = new WeakMap<Element, (e: MouseEvent | PointerEvent) => void>();

export function onDriverClick(
  element: Element,
  listener: (pointer: MouseEvent | PointerEvent) => void,
  shouldPreventDefault?: (target: HTMLElement) => boolean
) {
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

    if (e.type === "click") {
      listener?.(e);
    }
  };

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

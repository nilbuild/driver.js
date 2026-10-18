import type { DriveStep } from "./driver";

export function resolveElement(element: DriveStep["element"]): Element | null | undefined {
  if (typeof element === "function") {
    return element();
  }

  if (typeof element === "string") {
    return document.querySelector(element);
  }

  return element;
}

export function isScrollable(element: Element) {
  const style = window.getComputedStyle(element);
  return [style.overflow, style.overflowX, style.overflowY].some(value => {
    return value === "auto" || value === "scroll";
  });
}

export function easeInOutQuad(elapsed: number, initialValue: number, amountOfChange: number, duration: number): number {
  if ((elapsed /= duration / 2) < 1) {
    return (amountOfChange / 2) * elapsed * elapsed + initialValue;
  }
  return (-amountOfChange / 2) * (--elapsed * (elapsed - 2) - 1) + initialValue;
}

export function getFocusableElements(parentEls: Element[] | HTMLElement[]) {
  const focusableQuery =
    'a[href]:not([disabled]), button:not([disabled]), textarea:not([disabled]), input[type="text"]:not([disabled]), input[type="radio"]:not([disabled]), input[type="checkbox"]:not([disabled]), select:not([disabled])';

  return parentEls
    .flatMap(parentEl => {
      const isParentFocusable = parentEl.matches(focusableQuery);
      const focusableEls: HTMLElement[] = Array.from(parentEl.querySelectorAll(focusableQuery));

      return [...(isParentFocusable ? [parentEl as HTMLElement] : []), ...focusableEls];
    })
    .filter(el => {
      return getComputedStyle(el).pointerEvents !== "none" && isElementVisible(el);
    });
}

export function bringInView(element: Element, shouldSmoothScroll?: boolean) {
  if (!element || isElementInView(element)) {
    return;
  }

  const isTallerThanViewport = (element as HTMLElement).offsetHeight > window.innerHeight;

  element.scrollIntoView({
    // Removing the smooth scrolling for elements which exist inside the scrollable parent
    // This was causing the highlight to not properly render
    behavior: !shouldSmoothScroll || hasScrollableParent(element) ? "auto" : "smooth",
    inline: "center",
    block: isTallerThanViewport ? "start" : "center",
  });
}

function hasScrollableParent(e: Element) {
  if (!e || !e.parentElement) {
    return;
  }

  const parent = e.parentElement as HTMLElement & { scrollTopMax?: number };

  return parent.scrollHeight > parent.clientHeight;
}

function isElementInView(element: Element) {
  const rect = element.getBoundingClientRect();

  return (
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth)
  );
}

export function isElementVisible(el: HTMLElement) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

const dialogsWithLayer = new WeakSet<Element>();

// A modal <dialog> renders in the top layer, above everything in <body>, so
// UI for an element inside one has to live in that dialog to be visible.
export function layerFor(element: Element): Element {
  const dialog = element.closest("dialog[open]");
  if (!dialog) {
    return document.body;
  }

  if (!("showPopover" in dialog)) {
    return dialog;
  }

  let layer = dialog.querySelector<HTMLElement>(":scope > .driver-layer");
  if (!layer) {
    layer = document.createElement("div");
    layer.className = "driver-layer";
    layer.setAttribute("popover", "manual");
    dialog.appendChild(layer);
  }

  if (!dialogsWithLayer.has(dialog)) {
    dialogsWithLayer.add(dialog);
    dialog.addEventListener("close", () => {
      dialog.querySelector<HTMLElement>(":scope > .driver-layer:popover-open")?.hidePopover();
    });
  }

  if (!layer.matches(":popover-open")) {
    layer.showPopover();
  }

  return layer;
}

export function removeFromLayer(node: Element) {
  const layer = node.parentElement;
  node.remove();

  if (layer?.classList.contains("driver-layer") && !layer.childElementCount) {
    layer.remove();
  }
}

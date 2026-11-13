import type { DriveStep } from "../types";

export function resolveElement(element: DriveStep["element"]): Element | null | undefined {
  if (typeof element === "function") {
    return element();
  }

  if (typeof element === "string") {
    return document.querySelector(element);
  }

  return element;
}

export const DUMMY_ELEMENT_ID = "driver-dummy-element";

export function isDummyElement(element: Element | undefined): boolean {
  return !element || element.id === DUMMY_ELEMENT_ID;
}

export const ALLOWED_CLASS = "driver-allowed-element";
export const RAISED_CLASS = "driver-active-element-raised";

export function isInsideAllowedElement(element: Element): boolean {
  return !!element.closest(`.${ALLOWED_CLASS}`);
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

const FOCUSABLE_QUERY =
  "a[href], area[href], button:not([disabled]), " +
  'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), ' +
  "summary, audio[controls], video[controls], " +
  '[contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"]):not([disabled])';

function focusableCandidates(parentEls: Element[]): HTMLElement[] {
  return parentEls.flatMap(parentEl => {
    const isParentFocusable = parentEl.matches(FOCUSABLE_QUERY);
    const focusableEls: HTMLElement[] = Array.from(parentEl.querySelectorAll(FOCUSABLE_QUERY));

    return [...(isParentFocusable ? [parentEl as HTMLElement] : []), ...focusableEls];
  });
}

function isFocusable(el: HTMLElement) {
  return getComputedStyle(el).pointerEvents !== "none" && isElementVisible(el);
}

export function getFocusableElements(parentEls: Element[]) {
  return focusableCandidates(parentEls).filter(isFocusable);
}

export function bringInView(element: Element, shouldSmoothScroll?: boolean) {
  if (!element || isElementInView(element)) {
    return;
  }

  const isTallerThanViewport = (element as HTMLElement).offsetHeight > window.innerHeight;

  element.scrollIntoView({
    behavior: !shouldSmoothScroll || hasScrollableParent(element) ? "auto" : "smooth",
    inline: "center",
    block: isTallerThanViewport ? "start" : "center",
  });
}

function hasScrollableParent(e: Element) {
  if (!e || !e.parentElement) {
    return;
  }

  const parent = e.parentElement;

  return parent.scrollHeight > parent.clientHeight;
}

function isElementInView(element: Element) {
  const rect = element.getBoundingClientRect();

  const isInViewport =
    rect.top >= 0 &&
    rect.left >= 0 &&
    rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
    rect.right <= (window.innerWidth || document.documentElement.clientWidth);

  return isInViewport && !isClippedByScrollContainer(element, rect);
}

function isClippedByScrollContainer(element: Element, rect: DOMRect) {
  let current: Element | null = element;

  while (current) {
    if (getComputedStyle(current).position === "fixed") {
      return false;
    }

    const parent: HTMLElement | null = current.parentElement;
    if (!parent || parent === document.body || parent === document.documentElement) {
      return false;
    }

    if (isScrollable(parent)) {
      const box = parent.getBoundingClientRect();
      const top = box.top + parent.clientTop;
      const left = box.left + parent.clientLeft;

      const isClipped =
        rect.top < top ||
        rect.left < left ||
        rect.bottom > top + (parent.clientHeight || box.height) ||
        rect.right > left + (parent.clientWidth || box.width);

      if (isClipped) {
        return true;
      }
    }

    current = parent;
  }

  return false;
}

export function isElementVisible(el: HTMLElement) {
  return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
}

const dialogsWithLayer = new WeakSet<Element>();

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

function dropEmptyLayer(layer: Element | null) {
  if (layer?.classList.contains("driver-layer") && !layer.childElementCount) {
    layer.remove();
  }
}

export function removeFromLayer(node: Element) {
  const layer = node.parentElement;
  node.remove();
  dropEmptyLayer(layer);
}

export function placeInLayer(node: Element, layer: Element, isUnderneath = false) {
  if (isUnderneath && layer !== document.body) {
    layer.prepend(node);
    return;
  }

  layer.appendChild(node);
}

export function moveToLayerOf(node: Element, element: Element, isUnderneath = false): boolean {
  const layer = layerFor(element);
  const previous = node.parentElement;
  if (previous === layer) {
    return false;
  }

  placeInLayer(node, layer, isUnderneath);
  dropEmptyLayer(previous);

  return true;
}

const KEY_WIDGETS =
  "input, textarea, select, [role=combobox], [role=grid], [role=listbox], [role=menu], [role=menubar], " +
  "[role=radiogroup], [role=slider], [role=spinbutton], [role=tablist], [role=textbox], [role=tree], [role=treegrid]";

export function isKeyWidget(node: EventTarget | null | undefined): boolean {
  if (!(node instanceof HTMLElement)) {
    return false;
  }

  return node.isContentEditable || !!node.closest(KEY_WIDGETS);
}

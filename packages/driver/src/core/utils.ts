import type { DriveStep, ScrollIntoViewOpts } from "../types";

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
export const PAGE_INTERACTIVE_CLASS = "driver-page-interactive";

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
  const style = getComputedStyle(el);
  return style.pointerEvents !== "none" && style.visibility === "visible" && isElementVisible(el);
}

export function getFocusableElements(parentEls: Element[]) {
  return focusableCandidates(parentEls).filter(isFocusable);
}

export function bringInView(element: Element, shouldSmoothScroll?: boolean, position?: ScrollIntoViewOpts) {
  if (!element || isElementInView(element)) {
    return;
  }

  const isTallerThanViewport = (element as HTMLElement).offsetHeight > window.innerHeight;

  element.scrollIntoView({
    behavior: !shouldSmoothScroll || hasScrollableParent(element) ? "auto" : "smooth",
    inline: position?.inline ?? "center",
    block: position?.block ?? (isTallerThanViewport ? "start" : "center"),
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

  return isInViewport && !isClipped(element, rect);
}

function flatParent(element: Element): Element | null {
  const parent = element.assignedSlot ?? element.parentElement;
  if (parent) {
    return parent;
  }

  const root = element.parentNode;
  return root instanceof ShadowRoot ? root.host : null;
}

function matchesSafely(element: Element, selector: string): boolean {
  try {
    return element.matches(selector);
  } catch {
    return false;
  }
}

function containsPaint(style: CSSStyleDeclaration): boolean {
  return /paint|strict|content/.test(style.contain || "");
}

// whether `ancestor` is the containing block of a box positioned `position` (so its overflow clips that box)
function containsBox(style: CSSStyleDeclaration, position: string): boolean {
  if (position !== "absolute" && position !== "fixed") {
    return true;
  }

  const isTransformed =
    (style.transform || "none") !== "none" ||
    (style.perspective || "none") !== "none" ||
    (style.filter || "none") !== "none" ||
    /layout|paint|strict|content/.test(style.contain || "") ||
    /transform|perspective|filter/.test(style.willChange || "");

  return isTransformed || (position === "absolute" && style.position !== "static");
}

const clips = (overflow: string | undefined) => !!overflow && overflow !== "visible";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

// the part of the element its scrolling (or otherwise clipping) ancestors let you see. An element clipped out of sight
// entirely comes back as a sliver on the edge it is hidden behind.
export function visibleRect(element: Element): DOMRect {
  const rect = element.getBoundingClientRect();
  let { left, top, right, bottom } = rect;
  let position = getComputedStyle(element).position;

  for (let ancestor = flatParent(element); ancestor; ancestor = flatParent(ancestor)) {
    if (ancestor === document.body || ancestor === document.documentElement) {
      break;
    }

    const style = getComputedStyle(ancestor);
    if (!containsBox(style, position)) {
      continue;
    }

    const isPainted = containsPaint(style);
    const overflow = (style.overflow || "").split(" ");
    const clipsX = isPainted || clips(style.overflowX) || clips(overflow[0]);
    const clipsY = isPainted || clips(style.overflowY) || clips(overflow[1] ?? overflow[0]);
    if (clipsX || clipsY) {
      const box = ancestor.getBoundingClientRect();
      const boxLeft = box.left + ancestor.clientLeft;
      const boxTop = box.top + ancestor.clientTop;
      const boxRight = boxLeft + (ancestor.clientWidth || box.width);
      const boxBottom = boxTop + (ancestor.clientHeight || box.height);
      if (clipsX) {
        left = clamp(left, boxLeft, boxRight);
        right = clamp(right, boxLeft, boxRight);
      }
      if (clipsY) {
        top = clamp(top, boxTop, boxBottom);
        bottom = clamp(bottom, boxTop, boxBottom);
      }
    }

    // nothing outside the top layer clips what is in it
    if (matchesSafely(ancestor, ":modal, :popover-open")) {
      break;
    }

    position = style.position;
  }

  return new DOMRect(left, top, right - left, bottom - top);
}

function isClipped(element: Element, rect: DOMRect): boolean {
  const visible = visibleRect(element);

  return visible.width < rect.width || visible.height < rect.height;
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

// setTimeout fires at once past this many milliseconds, so a wait that long (or Infinity) has no timer at all
const LONGEST_TIMER = 2 ** 31 - 1;

export function isEndless(ms: number): boolean {
  return ms > LONGEST_TIMER;
}

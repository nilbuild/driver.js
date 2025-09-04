import { getConfig } from "./config";

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

export function bringInView(element: Element) {
  if (!element || isElementInView(element)) {
    return;
  }

  const shouldSmoothScroll = getConfig("smoothScroll");

  const isTallerThanViewport = (element as HTMLElement).offsetHeight > window.innerHeight;

  if (isTallerThanViewport) {
    const viewOffset = getConfig("viewOffset") || 10;
    bringInViewWithOffset(element, viewOffset);
    return;
  }

  element.scrollIntoView({
    // Removing the smooth scrolling for elements which exist inside the scrollable parent
    // This was causing the highlight to not properly render
    behavior: !shouldSmoothScroll || hasScrollableParent(element) ? "auto" : "smooth",
    inline: "center",
    block: "center",
  });
}

function bringInViewWithOffset(element: Element, offset: number) {
  if (!element || isElementInView(element)) {
    return;
  }

  const offsetNumber = (!offset || offset < 0) ? 10 : offset;

  const elementRect = element.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  const viewportWidth = window.innerWidth;

  // Check which direction we need to scroll
  const isAboveViewport = elementRect.bottom < 0;
  const isBelowViewport = elementRect.top > viewportHeight;
  const isLeftOfViewport = elementRect.right < 0;
  const isRightOfViewport = elementRect.left > viewportWidth;

  let scrollToY = window.pageYOffset;
  let scrollToX = window.pageXOffset;

  // Calculate vertical scroll position
  if (isAboveViewport) {
    scrollToY = elementRect.top + window.pageYOffset - offsetNumber;
  } else if (isBelowViewport) {
    scrollToY = elementRect.bottom + window.pageYOffset - viewportHeight + offsetNumber;
  }

  // Calculate horizontal scroll position
  if (isLeftOfViewport) {
    scrollToX = elementRect.left + window.pageXOffset - offsetNumber;
  } else if (isRightOfViewport) {
    scrollToX = elementRect.right + window.pageXOffset - viewportWidth + offsetNumber;
  }

  // Scroll to calculated position
  window.scrollTo({
    top: Math.max(0, scrollToY),
    left: Math.max(0, scrollToX),
    behavior: "smooth"
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

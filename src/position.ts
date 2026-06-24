import { getConfig } from "./config";
import { DriveStep } from "./driver";
import type { Alignment, Side } from "./popover";
import { getState } from "./state";

// Internal placement. Beyond the public sides it includes "over", used when
// there is no target element (or the popover is intentionally centered like a
// modal). "over" is not part of the public `side` option.
type Placement = Side | "over";

type PopoverDimensions = {
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
};

function getPopoverDimensions(): PopoverDimensions | undefined {
  const popover = getState("popover");
  if (!popover?.wrapper) {
    return;
  }

  const boundingClientRect = popover.wrapper.getBoundingClientRect();

  const stagePadding = getConfig("stagePadding") || 0;
  const popoverOffset = getConfig("popoverOffset") || 0;

  return {
    width: boundingClientRect.width + stagePadding + popoverOffset,
    height: boundingClientRect.height + stagePadding + popoverOffset,

    realWidth: boundingClientRect.width,
    realHeight: boundingClientRect.height,
  };
}

function calculateTopForLeftRight(
  alignment: Alignment,
  config: {
    elementDimensions: DOMRect;
    popoverDimensions: PopoverDimensions;
    popoverPadding: number;
    popoverArrowDimensions: { width: number; height: number };
  }
): number {
  const { elementDimensions, popoverDimensions, popoverPadding, popoverArrowDimensions } = config;

  if (alignment === "start") {
    return Math.max(
      Math.min(
        elementDimensions.top - popoverPadding,
        window.innerHeight - popoverDimensions!.realHeight - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  if (alignment === "end") {
    return Math.max(
      Math.min(
        elementDimensions.top - popoverDimensions?.realHeight + elementDimensions.height + popoverPadding,
        window.innerHeight - popoverDimensions?.realHeight - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  if (alignment === "center") {
    return Math.max(
      Math.min(
        elementDimensions.top + elementDimensions.height / 2 - popoverDimensions?.realHeight / 2,
        window.innerHeight - popoverDimensions?.realHeight - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  return 0;
}

// Calculate the left placement for top and bottom sides
function calculateLeftForTopBottom(
  alignment: Alignment,
  config: {
    elementDimensions: DOMRect;
    popoverDimensions: PopoverDimensions;
    popoverPadding: number;
    popoverArrowDimensions: { width: number; height: number };
  }
): number {
  const { elementDimensions, popoverDimensions, popoverPadding, popoverArrowDimensions } = config;

  if (alignment === "start") {
    return Math.max(
      Math.min(
        elementDimensions.left - popoverPadding,
        window.innerWidth - popoverDimensions!.realWidth - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  if (alignment === "end") {
    return Math.max(
      Math.min(
        elementDimensions.left - popoverDimensions?.realWidth + elementDimensions.width + popoverPadding,
        window.innerWidth - popoverDimensions?.realWidth - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  if (alignment === "center") {
    return Math.max(
      Math.min(
        elementDimensions.left + elementDimensions.width / 2 - popoverDimensions?.realWidth / 2,
        window.innerWidth - popoverDimensions?.realWidth - popoverArrowDimensions.width
      ),
      popoverArrowDimensions.width
    );
  }

  return 0;
}

export function repositionPopover(element: Element, step: DriveStep) {
  const popover = getState("popover");
  if (!popover) {
    return;
  }

  const { align = "start", side = "bottom" } = step?.popover || {};

  // Configure the popover positioning
  const requiredAlignment: Alignment = align;
  const requiredSide: Placement = element.id === "driver-dummy-element" ? "over" : side;
  const popoverPadding = getConfig("stagePadding") || 0;

  const popoverDimensions = getPopoverDimensions()!;
  const popoverArrowDimensions = popover.arrow.getBoundingClientRect();
  const elementDimensions = element.getBoundingClientRect();

  const topValue = elementDimensions.top - popoverDimensions!.height;
  let isTopOptimal = topValue >= 0;

  const bottomValue = window.innerHeight - (elementDimensions.bottom + popoverDimensions!.height);
  let isBottomOptimal = bottomValue >= 0;

  const leftValue = elementDimensions.left - popoverDimensions!.width;
  let isLeftOptimal = leftValue >= 0;

  const rightValue = window.innerWidth - (elementDimensions.right + popoverDimensions!.width);
  let isRightOptimal = rightValue >= 0;

  const noneOptimal = !isTopOptimal && !isBottomOptimal && !isLeftOptimal && !isRightOptimal;
  let popoverRenderedSide: Placement = requiredSide;

  if (requiredSide === "top" && isTopOptimal) {
    isRightOptimal = isLeftOptimal = isBottomOptimal = false;
  } else if (requiredSide === "bottom" && isBottomOptimal) {
    isRightOptimal = isLeftOptimal = isTopOptimal = false;
  } else if (requiredSide === "left" && isLeftOptimal) {
    isRightOptimal = isTopOptimal = isBottomOptimal = false;
  } else if (requiredSide === "right" && isRightOptimal) {
    isLeftOptimal = isTopOptimal = isBottomOptimal = false;
  }

  if (requiredSide === "over") {
    const leftToSet = window.innerWidth / 2 - popoverDimensions!.realWidth / 2;
    const topToSet = window.innerHeight / 2 - popoverDimensions!.realHeight / 2;

    popover.wrapper.style.left = `${leftToSet}px`;
    popover.wrapper.style.right = `auto`;
    popover.wrapper.style.top = `${topToSet}px`;
    popover.wrapper.style.bottom = `auto`;
  } else if (noneOptimal) {
    const leftValue = window.innerWidth / 2 - popoverDimensions?.realWidth! / 2;
    const bottomValue = 10;

    popover.wrapper.style.left = `${leftValue}px`;
    popover.wrapper.style.right = `auto`;
    popover.wrapper.style.bottom = `${bottomValue}px`;
    popover.wrapper.style.top = `auto`;
  } else if (isLeftOptimal) {
    const leftToSet = Math.min(
      leftValue,
      window.innerWidth - popoverDimensions?.realWidth - popoverArrowDimensions.width
    );

    const topToSet = calculateTopForLeftRight(requiredAlignment, {
      elementDimensions,
      popoverDimensions,
      popoverPadding,
      popoverArrowDimensions,
    });

    popover.wrapper.style.left = `${leftToSet}px`;
    popover.wrapper.style.top = `${topToSet}px`;
    popover.wrapper.style.bottom = `auto`;
    popover.wrapper.style.right = "auto";

    popoverRenderedSide = "left";
  } else if (isRightOptimal) {
    const rightToSet = Math.min(
      rightValue,
      window.innerWidth - popoverDimensions?.realWidth - popoverArrowDimensions.width
    );
    const topToSet = calculateTopForLeftRight(requiredAlignment, {
      elementDimensions,
      popoverDimensions,
      popoverPadding,
      popoverArrowDimensions,
    });

    popover.wrapper.style.right = `${rightToSet}px`;
    popover.wrapper.style.top = `${topToSet}px`;
    popover.wrapper.style.bottom = `auto`;
    popover.wrapper.style.left = "auto";

    popoverRenderedSide = "right";
  } else if (isTopOptimal) {
    const topToSet = Math.min(
      topValue,
      window.innerHeight - popoverDimensions!.realHeight - popoverArrowDimensions.width
    );
    let leftToSet = calculateLeftForTopBottom(requiredAlignment, {
      elementDimensions,
      popoverDimensions,
      popoverPadding,
      popoverArrowDimensions,
    });

    popover.wrapper.style.top = `${topToSet}px`;
    popover.wrapper.style.left = `${leftToSet}px`;
    popover.wrapper.style.bottom = `auto`;
    popover.wrapper.style.right = "auto";

    popoverRenderedSide = "top";
  } else if (isBottomOptimal) {
    const bottomToSet = Math.min(
      bottomValue,
      window.innerHeight - popoverDimensions?.realHeight - popoverArrowDimensions.width
    );

    let leftToSet = calculateLeftForTopBottom(requiredAlignment, {
      elementDimensions,
      popoverDimensions,
      popoverPadding,
      popoverArrowDimensions,
    });

    popover.wrapper.style.left = `${leftToSet}px`;
    popover.wrapper.style.bottom = `${bottomToSet}px`;
    popover.wrapper.style.top = `auto`;
    popover.wrapper.style.right = "auto";

    popoverRenderedSide = "bottom";
  }

  // Point the arrow at the element. When no side is optimal the popover is
  // detached from the element (centered/pinned to the bottom of the screen),
  // so there is nothing sensible to point at and the arrow is hidden.
  renderPopoverArrow(noneOptimal ? "over" : popoverRenderedSide, requiredAlignment, element);

  [...popover.wrapper.classList]
    .filter(className => className.startsWith("driver-popover-side-") || className.startsWith("driver-popover-align-"))
    .forEach(className => popover.wrapper.classList.remove(className));

  popover.wrapper.classList.add(`driver-popover-side-${popoverRenderedSide}`);
  popover.wrapper.classList.add(`driver-popover-align-${requiredAlignment}`);
}

// The arrow is a CSS triangle built from 5px borders, so its bounding box is
// 10x10 regardless of where it is rendered.
const ARROW_SIZE = 10;

// Keep the arrow this far from the popover's corners so it never collides with
// the rounded corners.
const ARROW_CORNER_INSET = 15;

// Finds the point the arrow should aim at along one axis, returned relative to
// the popover's leading edge (`popoverStart`). All inputs are viewport coords.
//
// When the element fully spans the popover edge the arrow could point anywhere
// along the popover and still land on the element, so there is slack to spend:
// we resolve it with the configured alignment (start/center/end), which makes
// the arrow echo the popover's own alignment.
//
// Otherwise we aim at the center of the region where the element and popover
// overlap. This tracks the element rather than its geometric center (which can
// sit far off-screen for an element much taller/wider than the popover), and
// when the two don't overlap at all the clamped endpoints collapse onto the
// nearest edge, pointing the arrow that way.
export function calculateArrowTarget(
  elementStart: number,
  elementEnd: number,
  popoverStart: number,
  popoverEnd: number,
  alignment: Alignment
): number {
  const popoverLength = popoverEnd - popoverStart;
  const fullySpansPopover = elementStart <= popoverStart && elementEnd >= popoverEnd;

  if (fullySpansPopover) {
    if (alignment === "start") {
      return ARROW_CORNER_INSET + ARROW_SIZE / 2;
    }

    if (alignment === "end") {
      return popoverLength - ARROW_CORNER_INSET - ARROW_SIZE / 2;
    }

    return popoverLength / 2;
  }

  const overlapStart = Math.min(Math.max(elementStart, popoverStart), popoverEnd);
  const overlapEnd = Math.min(Math.max(elementEnd, popoverStart), popoverEnd);

  return (overlapStart + overlapEnd) / 2 - popoverStart;
}

// Turns the target point into the inline offset for the arrow box, clamped so
// the whole arrow stays attached to the popover body and clear of its rounded
// corners. `popoverLength` is the popover's size along the arrow's edge.
export function calculateArrowOffset(targetCenter: number, popoverLength: number): number {
  const minOffset = ARROW_CORNER_INSET;
  const maxOffset = popoverLength - ARROW_CORNER_INSET - ARROW_SIZE;

  // The popover is too small to honor the corner insets; center the arrow.
  if (maxOffset < minOffset) {
    return Math.max(0, (popoverLength - ARROW_SIZE) / 2);
  }

  const offset = targetCenter - ARROW_SIZE / 2;
  return Math.min(Math.max(offset, minOffset), maxOffset);
}

// Decides which popover edge the arrow sits on. Normally this is the rendered
// side, but when the element scrolls clear of the popover along that side's axis
// (e.g. a left-placed popover whose element has scrolled above it), the arrow
// moves to the perpendicular edge so it keeps pointing at the element instead of
// sliding into a corner and pointing into empty space.
//
// Note the inverted naming of the arrow classes: "bottom" sits on the popover's
// top edge pointing up, "top" sits on the bottom edge pointing down, "right"
// sits on the left edge pointing left, and "left" sits on the right edge
// pointing right.
export function resolveArrowSide(
  side: Side,
  element: { top: number; bottom: number; left: number; right: number },
  popover: { top: number; bottom: number; left: number; right: number }
): Side {
  if (side === "left" || side === "right") {
    const overlapsVertically = element.bottom > popover.top && element.top < popover.bottom;
    if (overlapsVertically) {
      return side;
    }

    return element.bottom <= popover.top ? "bottom" : "top";
  }

  const overlapsHorizontally = element.right > popover.left && element.left < popover.right;
  if (overlapsHorizontally) {
    return side;
  }

  return element.right <= popover.left ? "right" : "left";
}

function renderPopoverArrow(side: Placement, alignment: Alignment, element: Element) {
  const popover = getState("popover");
  if (!popover) {
    return;
  }

  const popoverArrow = popover.arrow;

  // Reset everything a previous render may have set, both classes and the
  // inline offset, so we start from a clean slate.
  popoverArrow.className = "driver-popover-arrow";
  popoverArrow.style.top = "";
  popoverArrow.style.right = "";
  popoverArrow.style.bottom = "";
  popoverArrow.style.left = "";

  // The popover is rendered over the element (e.g. a free floating popover) or
  // detached from it, so there is nothing to point at.
  if (side === "over") {
    popoverArrow.classList.add("driver-popover-arrow-none");
    return;
  }

  const elementRect = element.getBoundingClientRect();
  const popoverRect = popover.wrapper.getBoundingClientRect();

  const arrowSide = resolveArrowSide(side, elementRect, popoverRect);

  // The side class controls which popover edge the arrow sits on (and the
  // direction it points). The offset along that edge is set inline below.
  popoverArrow.classList.add(`driver-popover-arrow-side-${arrowSide}`);

  // Arrow sides left/right sit on vertical edges (positioned by `top`); top and
  // bottom sit on horizontal edges (positioned by `left`).
  if (arrowSide === "left" || arrowSide === "right") {
    const target = calculateArrowTarget(
      elementRect.top,
      elementRect.bottom,
      popoverRect.top,
      popoverRect.bottom,
      alignment
    );
    popoverArrow.style.top = `${calculateArrowOffset(target, popoverRect.height)}px`;
  } else {
    const target = calculateArrowTarget(
      elementRect.left,
      elementRect.right,
      popoverRect.left,
      popoverRect.right,
      alignment
    );
    popoverArrow.style.left = `${calculateArrowOffset(target, popoverRect.width)}px`;
  }
}

import type { Alignment, PopoverDOM, Side } from "./popover";

type Placement = Side | "over";

export type PositionOptions = {
  side: Side;
  align: Alignment;
  offset: number;
  padding: number;
  centered?: boolean;
};

type PopoverDimensions = {
  width: number;
  height: number;
  realWidth: number;
  realHeight: number;
};

function getPopoverDimensions(popover: PopoverDOM, offset: number): PopoverDimensions {
  const boundingClientRect = popover.wrapper.getBoundingClientRect();

  return {
    width: boundingClientRect.width + offset,
    height: boundingClientRect.height + offset,

    realWidth: boundingClientRect.width,
    realHeight: boundingClientRect.height,
  };
}

function alignAlongEdge(
  alignment: Alignment,
  elementStart: number,
  elementSize: number,
  popoverSize: number,
  viewportSize: number,
  padding: number,
  arrowSize: number
): number {
  let start: number;
  if (alignment === "start") {
    start = elementStart - padding;
  } else if (alignment === "end") {
    start = elementStart - popoverSize + elementSize + padding;
  } else if (alignment === "center") {
    start = elementStart + elementSize / 2 - popoverSize / 2;
  } else {
    return 0;
  }

  return Math.max(Math.min(start, viewportSize - popoverSize - arrowSize), arrowSize);
}

export function repositionPopover(popover: PopoverDOM, anchor: Element, options: PositionOptions) {
  const { align: requiredAlignment, side } = options;
  const requiredSide: Placement = options.centered ? "over" : side;
  const popoverPadding = options.padding;
  const { style, classList } = popover.wrapper;

  const popoverDimensions = getPopoverDimensions(popover, options.offset);
  const popoverArrowDimensions = popover.arrow.getBoundingClientRect();
  const elementDimensions = anchor.getBoundingClientRect();

  const topValue = elementDimensions.top - popoverDimensions.height;
  let isTopOptimal = topValue >= 0;

  const bottomValue = window.innerHeight - (elementDimensions.bottom + popoverDimensions.height);
  let isBottomOptimal = bottomValue >= 0;

  const leftValue = elementDimensions.left - popoverDimensions.width;
  let isLeftOptimal = leftValue >= 0;

  const rightValue = window.innerWidth - (elementDimensions.right + popoverDimensions.width);
  let isRightOptimal = rightValue >= 0;

  const arrowSize = popoverArrowDimensions.width;
  const alignTop = () =>
    alignAlongEdge(
      requiredAlignment,
      elementDimensions.top,
      elementDimensions.height,
      popoverDimensions.realHeight,
      window.innerHeight,
      popoverPadding,
      arrowSize
    );
  const alignLeft = () =>
    alignAlongEdge(
      requiredAlignment,
      elementDimensions.left,
      elementDimensions.width,
      popoverDimensions.realWidth,
      window.innerWidth,
      popoverPadding,
      arrowSize
    );

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

  const place = (edge: Side, value?: number) => {
    style[edge] = value === undefined ? "auto" : `${value}px`;
  };
  const centeredLeft = window.innerWidth / 2 - popoverDimensions.realWidth / 2;
  const maxLeft = window.innerWidth - popoverDimensions.realWidth - arrowSize;
  const maxTop = window.innerHeight - popoverDimensions.realHeight - arrowSize;

  if (requiredSide === "over") {
    place("left", centeredLeft);
    place("right");
    place("top", window.innerHeight / 2 - popoverDimensions.realHeight / 2);
    place("bottom");
  } else if (noneOptimal) {
    place("left", centeredLeft);
    place("right");
    place("bottom", 10);
    place("top");
  } else if (isLeftOptimal) {
    place("left", Math.min(leftValue, maxLeft));
    place("top", alignTop());
    place("bottom");
    place("right");

    popoverRenderedSide = "left";
  } else if (isRightOptimal) {
    place("right", Math.min(rightValue, maxLeft));
    place("top", alignTop());
    place("bottom");
    place("left");

    popoverRenderedSide = "right";
  } else if (isTopOptimal) {
    place("top", Math.min(topValue, maxTop));
    place("left", alignLeft());
    place("bottom");
    place("right");

    popoverRenderedSide = "top";
  } else if (isBottomOptimal) {
    place("left", alignLeft());
    place("bottom", Math.min(bottomValue, maxTop));
    place("top");
    place("right");

    popoverRenderedSide = "bottom";
  }

  renderPopoverArrow(popover, noneOptimal ? "over" : popoverRenderedSide, requiredAlignment, anchor);

  [...classList]
    .filter(className => className.startsWith("driver-popover-side-") || className.startsWith("driver-popover-align-"))
    .forEach(className => classList.remove(className));

  classList.add(`driver-popover-side-${popoverRenderedSide}`);
  classList.add(`driver-popover-align-${requiredAlignment}`);
}

export const ARROW_SIZE = 10;

export const ARROW_CORNER_INSET = 15;

export function calculateArrowTarget(
  elementStart: number,
  elementEnd: number,
  popoverStart: number,
  popoverEnd: number,
  alignment: Alignment,
  arrowSize: number = ARROW_SIZE
): number {
  const popoverLength = popoverEnd - popoverStart;
  const fullySpansPopover = elementStart <= popoverStart && elementEnd >= popoverEnd;

  if (fullySpansPopover) {
    if (alignment === "start") {
      return ARROW_CORNER_INSET + arrowSize / 2;
    }

    if (alignment === "end") {
      return popoverLength - ARROW_CORNER_INSET - arrowSize / 2;
    }

    return popoverLength / 2;
  }

  const overlapStart = Math.min(Math.max(elementStart, popoverStart), popoverEnd);
  const overlapEnd = Math.min(Math.max(elementEnd, popoverStart), popoverEnd);

  return (overlapStart + overlapEnd) / 2 - popoverStart;
}

export function calculateArrowOffset(
  targetCenter: number,
  popoverLength: number,
  arrowSize: number = ARROW_SIZE
): number {
  const minOffset = ARROW_CORNER_INSET;
  const maxOffset = popoverLength - ARROW_CORNER_INSET - arrowSize;

  if (maxOffset < minOffset) {
    return Math.max(0, (popoverLength - arrowSize) / 2);
  }

  const offset = targetCenter - arrowSize / 2;
  return Math.min(Math.max(offset, minOffset), maxOffset);
}

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

function renderPopoverArrow(popover: PopoverDOM, side: Placement, alignment: Alignment, anchor: Element) {
  const popoverArrow = popover.arrow;

  popoverArrow.className = "driver-popover-arrow";
  popoverArrow.style.top = "";
  popoverArrow.style.right = "";
  popoverArrow.style.bottom = "";
  popoverArrow.style.left = "";

  if (side === "over") {
    popoverArrow.classList.add("driver-popover-arrow-none");
    return;
  }

  const elementRect = anchor.getBoundingClientRect();
  const popoverRect = popover.wrapper.getBoundingClientRect();

  const arrowSide = resolveArrowSide(side, elementRect, popoverRect);

  popoverArrow.classList.add(`driver-popover-arrow-side-${arrowSide}`);

  const arrowSize = popoverArrow.getBoundingClientRect().width || ARROW_SIZE;

  if (arrowSide === "left" || arrowSide === "right") {
    const target = calculateArrowTarget(
      elementRect.top,
      elementRect.bottom,
      popoverRect.top,
      popoverRect.bottom,
      alignment,
      arrowSize
    );
    popoverArrow.style.top = `${calculateArrowOffset(target, popoverRect.height, arrowSize)}px`;
  } else {
    const target = calculateArrowTarget(
      elementRect.left,
      elementRect.right,
      popoverRect.left,
      popoverRect.right,
      alignment,
      arrowSize
    );
    popoverArrow.style.left = `${calculateArrowOffset(target, popoverRect.width, arrowSize)}px`;
  }
}

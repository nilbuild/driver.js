import type { DriverHook, HookOpts } from "./context";
import { destroyDriverClick, onDriverClick } from "./click";
import { PositionOptions, repositionPopover } from "./position";
import { bringInView, getFocusableElements, layerFor, removeFromLayer } from "./utils";

export type Side = "top" | "right" | "bottom" | "left";
export type Alignment = "start" | "center" | "end";
export type AllowedButtons = "next" | "previous" | "close";

// The popover configuration of a tour step / highlight. This is the public
// shape users pass in; the primitive below works on the fully resolved
// PopoverRenderOptions instead, which the tour derives from this and its
// global config (see step-popover.ts).
export type Popover = {
  title?: string;
  description?: string;
  side?: Side;
  align?: Alignment;

  showButtons?: AllowedButtons[];
  showProgress?: boolean;
  disableButtons?: AllowedButtons[];

  popoverClass?: string;

  // Button texts
  progressText?: string;
  doneBtnText?: string;
  nextBtnText?: string;
  prevBtnText?: string;
  closeBtnLabel?: string;

  // Called after the popover is rendered
  onPopoverRender?: (popover: PopoverDOM, opts: HookOpts) => void;

  // Button callbacks
  onNextClick?: DriverHook;
  onPrevClick?: DriverHook;
  onCloseClick?: DriverHook;
  onDoneClick?: DriverHook;
};

export type PopoverDOM = {
  wrapper: HTMLElement;
  arrow: HTMLElement;
  title: HTMLElement;
  description: HTMLElement;
  footer: HTMLElement;
  progress: HTMLElement;
  previousButton: HTMLButtonElement;
  nextButton: HTMLButtonElement;
  closeButton: HTMLButtonElement;
  footerButtons: HTMLElement;
};

// Everything the primitive needs to render a popover, fully resolved by the
// caller; no config or state fallbacks happen at this level.
export type PopoverRenderOptions = {
  title?: string;
  description?: string;

  showButtons: AllowedButtons[];
  disableButtons: AllowedButtons[];
  showProgress: boolean;

  progressText: string;
  nextBtnText: string;
  prevBtnText: string;
  closeBtnLabel: string;

  // Style the next button as the tour's done button.
  doneButton?: boolean;

  popoverClass?: string;
  smoothScroll?: boolean;

  // Button clicks, resolved by the caller. Deciding between step hooks,
  // global hooks and default behaviour is the caller's business.
  onNextClick?: () => void;
  onPrevClick?: () => void;
  onCloseClick?: () => void;

  // Called once the popover is in the DOM, before it is positioned.
  onRender?: (popover: PopoverDOM) => void;

  position: PositionOptions;
};

export function hidePopover(popover: PopoverDOM | undefined) {
  if (!popover) {
    return;
  }

  popover.wrapper.style.display = "none";
}

export function renderPopover(anchor: Element, options: PopoverRenderOptions): PopoverDOM {
  const popover = createPopover();
  layerFor(anchor).appendChild(popover.wrapper);

  const { title, description, showButtons, disableButtons, showProgress, nextBtnText, prevBtnText, progressText } =
    options;

  popover.nextButton.innerHTML = nextBtnText;
  popover.previousButton.innerHTML = prevBtnText;
  popover.progress.innerHTML = progressText;
  popover.closeButton.setAttribute("aria-label", options.closeBtnLabel);

  if (options.doneButton) {
    popover.nextButton.classList.add("driver-popover-done-btn");
  }

  if (title) {
    popover.title.innerHTML = title;
    popover.title.style.display = "block";
  } else {
    popover.title.style.display = "none";
  }

  if (description) {
    popover.description.innerHTML = description;
    popover.description.style.display = "block";
  } else {
    popover.description.style.display = "none";
  }

  const showFooter = showButtons.includes("next") || showButtons.includes("previous") || showProgress;

  popover.closeButton.style.display = showButtons.includes("close") ? "block" : "none";

  if (showFooter) {
    popover.footer.style.display = "flex";

    popover.progress.style.display = showProgress ? "block" : "none";
    popover.nextButton.style.display = showButtons.includes("next") ? "block" : "none";
    popover.previousButton.style.display = showButtons.includes("previous") ? "block" : "none";
  } else {
    popover.footer.style.display = "none";
  }

  if (disableButtons.includes("next")) {
    popover.nextButton.disabled = true;
    popover.nextButton.classList.add("driver-popover-btn-disabled");
  }

  if (disableButtons.includes("previous")) {
    popover.previousButton.disabled = true;
    popover.previousButton.classList.add("driver-popover-btn-disabled");
  }

  if (disableButtons.includes("close")) {
    popover.closeButton.disabled = true;
    popover.closeButton.classList.add("driver-popover-btn-disabled");
  }

  // Reset the popover position
  const popoverWrapper = popover.wrapper;
  popoverWrapper.style.display = "block";
  popoverWrapper.style.left = "";
  popoverWrapper.style.top = "";
  popoverWrapper.style.bottom = "";
  popoverWrapper.style.right = "";

  popoverWrapper.id = "driver-popover-content";
  popoverWrapper.setAttribute("role", "dialog");
  popoverWrapper.setAttribute("aria-labelledby", "driver-popover-title");
  popoverWrapper.setAttribute("aria-describedby", "driver-popover-description");

  // Reset the classes responsible for the arrow position
  const popoverArrow = popover.arrow;
  popoverArrow.className = "driver-popover-arrow";

  // Reset any custom classes on the popover
  popoverWrapper.className = `driver-popover ${options.popoverClass || ""}`.trim();

  // Handles the popover button clicks
  onDriverClick(
    popover.wrapper,
    e => {
      // Synthetic events can target a Text node, which has no closest()
      const target = e.target instanceof Element ? e.target : (e.target as Node | null)?.parentElement;
      if (!target) {
        return undefined;
      }

      if (!!target.closest(".driver-popover-next-btn")) {
        return options.onNextClick?.();
      }

      if (!!target.closest(".driver-popover-prev-btn")) {
        return options.onPrevClick?.();
      }

      if (!!target.closest(".driver-popover-close-btn")) {
        return options.onCloseClick?.();
      }

      return undefined;
    },
    target => {
      // Only prevent the default action if we're clicking on a driver button.
      // This allows links inside the popover title/description, as well as
      // custom buttons added through onPopoverRender, to behave normally.
      if (popover.description.contains(target) || popover.title.contains(target)) {
        return false;
      }

      return !!target.closest(".driver-popover-prev-btn, .driver-popover-next-btn, .driver-popover-close-btn");
    }
  );

  options.onRender?.(popover);

  repositionPopover(popover, anchor, options.position);
  repositionOnImagesLoad(popover, anchor, options.position);
  bringInView(popoverWrapper, options.smoothScroll);

  // Focus on the first focusable element in the popover or the anchor. The
  // anchor is always scanned: a 0x0 anchor (like the tour's dummy element for
  // anchor-less popovers) never yields a focusable element anyway.
  const focusableElement = getFocusableElements([popoverWrapper, anchor]);
  if (focusableElement.length > 0) {
    focusableElement[0].focus();
  }

  return popover;
}

function repositionOnImagesLoad(popover: PopoverDOM, anchor: Element, position: PositionOptions) {
  const images = popover.wrapper.querySelectorAll("img");

  images.forEach(image => {
    if (image.complete) {
      return;
    }

    const reposition = () => repositionPopover(popover, anchor, position);

    image.addEventListener("load", reposition, { once: true });
    image.addEventListener("error", reposition, { once: true });
  });
}

function createPopover(): PopoverDOM {
  const wrapper = document.createElement("div");
  wrapper.classList.add("driver-popover");

  const arrow = document.createElement("div");
  arrow.classList.add("driver-popover-arrow");

  const title = document.createElement("header");
  title.id = "driver-popover-title";
  title.classList.add("driver-popover-title");
  title.style.display = "none";
  title.innerText = "Popover Title";

  const description = document.createElement("div");
  description.id = "driver-popover-description";
  description.classList.add("driver-popover-description");
  description.style.display = "none";
  description.innerText = "Popover description is here";

  const closeButton = document.createElement("button");
  closeButton.type = "button";
  closeButton.classList.add("driver-popover-close-btn");
  closeButton.innerHTML = "&times;";

  const footer = document.createElement("footer");
  footer.classList.add("driver-popover-footer");

  const progress = document.createElement("span");
  progress.classList.add("driver-popover-progress-text");
  progress.innerText = "";

  const footerButtons = document.createElement("span");
  footerButtons.classList.add("driver-popover-navigation-btns");

  const previousButton = document.createElement("button");
  previousButton.type = "button";
  previousButton.classList.add("driver-popover-prev-btn", "driver-popover-footer-btn");
  previousButton.innerHTML = "Previous";

  const nextButton = document.createElement("button");
  nextButton.type = "button";
  nextButton.classList.add("driver-popover-next-btn", "driver-popover-footer-btn");
  nextButton.innerHTML = "Next";

  footerButtons.appendChild(previousButton);
  footerButtons.appendChild(nextButton);
  footer.appendChild(progress);
  footer.appendChild(footerButtons);

  wrapper.appendChild(closeButton);
  wrapper.appendChild(arrow);
  wrapper.appendChild(title);
  wrapper.appendChild(description);
  wrapper.appendChild(footer);

  return {
    wrapper,
    arrow,
    title,
    description,
    footer,
    previousButton,
    nextButton,
    closeButton,
    footerButtons,
    progress,
  };
}

export function destroyPopover(popover: PopoverDOM | undefined) {
  if (!popover) {
    return;
  }

  destroyDriverClick(popover.wrapper);
  removeFromLayer(popover.wrapper);
}

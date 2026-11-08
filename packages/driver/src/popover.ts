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

  keepFocus?: boolean;

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

const customClasses = new WeakMap<HTMLElement, string[]>();
const appliedHtml = new WeakMap<HTMLElement, string>();

function setHtml(element: HTMLElement, html: string) {
  if (appliedHtml.get(element) === html) {
    return;
  }

  element.innerHTML = html;
  appliedHtml.set(element, html);
}

function toggleButton(button: HTMLButtonElement, isDisabled: boolean) {
  button.disabled = isDisabled;
  button.classList.toggle("driver-popover-btn-disabled", isDisabled);
}

function applyPopoverContent(popover: PopoverDOM, options: PopoverRenderOptions) {
  const { title, description, showButtons, disableButtons, showProgress, nextBtnText, prevBtnText, progressText } =
    options;

  setHtml(popover.nextButton, nextBtnText);
  setHtml(popover.previousButton, prevBtnText);
  setHtml(popover.progress, progressText);
  popover.closeButton.setAttribute("aria-label", options.closeBtnLabel);
  popover.nextButton.classList.toggle("driver-popover-done-btn", !!options.doneButton);

  if (title) {
    setHtml(popover.title, title);
    popover.title.style.display = "block";
  } else {
    popover.title.style.display = "none";
  }

  if (description) {
    setHtml(popover.description, description);
    popover.description.style.display = "block";
  } else {
    popover.description.style.display = "none";
  }

  const showFooter = showButtons.includes("next") || showButtons.includes("previous") || showProgress;

  popover.closeButton.style.display = showButtons.includes("close") ? "block" : "none";

  popover.footer.style.display = showFooter ? "flex" : "none";
  popover.progress.style.display = showProgress ? "block" : "none";
  popover.nextButton.style.display = showButtons.includes("next") ? "block" : "none";
  popover.previousButton.style.display = showButtons.includes("previous") ? "block" : "none";

  toggleButton(popover.nextButton, disableButtons.includes("next"));
  toggleButton(popover.previousButton, disableButtons.includes("previous"));
  toggleButton(popover.closeButton, disableButtons.includes("close"));

  const wrapper = popover.wrapper;
  wrapper.classList.remove(...(customClasses.get(wrapper) || []));
  const classes = (options.popoverClass || "").split(/\s+/).filter(Boolean);
  wrapper.classList.add(...classes);
  customClasses.set(wrapper, classes);
}

function isUnreachable(element: Element, root: HTMLElement): boolean {
  if ((element as HTMLButtonElement).disabled) {
    return true;
  }

  for (let node: Element | null = element; node && node !== root; node = node.parentElement) {
    if ((node as HTMLElement).style?.display === "none") {
      return true;
    }
  }

  return false;
}

export function updatePopoverContent(popover: PopoverDOM, anchor: Element, options: PopoverRenderOptions) {
  const focused = document.activeElement;
  const hadFocus = !!focused && popover.wrapper.contains(focused) && focused !== popover.wrapper;

  applyPopoverContent(popover, options);

  if (hadFocus && (!focused!.isConnected || isUnreachable(focused!, popover.wrapper))) {
    popover.wrapper.setAttribute("tabindex", "-1");
    popover.wrapper.focus();
  }

  repositionPopover(popover, anchor, options.position);
  repositionOnImagesLoad(popover, anchor, options.position);
}

export function renderPopover(anchor: Element, options: PopoverRenderOptions): PopoverDOM {
  const popover = createPopover();
  layerFor(anchor).appendChild(popover.wrapper);

  const popoverWrapper = popover.wrapper;
  popoverWrapper.className = "driver-popover";
  applyPopoverContent(popover, options);

  popoverWrapper.style.display = "block";
  popoverWrapper.style.left = "";
  popoverWrapper.style.top = "";
  popoverWrapper.style.bottom = "";
  popoverWrapper.style.right = "";

  popoverWrapper.id = "driver-popover-content";
  popoverWrapper.setAttribute("role", "dialog");
  popoverWrapper.setAttribute("aria-labelledby", "driver-popover-title");
  popoverWrapper.setAttribute("aria-describedby", "driver-popover-description");

  popover.arrow.className = "driver-popover-arrow";

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
  const focusableElement = options.keepFocus ? [] : getFocusableElements([popoverWrapper, anchor]);
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

  const title = document.createElement("div");
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

  const footer = document.createElement("div");
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

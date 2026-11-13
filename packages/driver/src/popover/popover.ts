import { destroyDriverClick, onDriverClick } from "../core/click";
import { PositionOptions, repositionPopover } from "./position";
import { bringInView, layerFor, removeFromLayer } from "../core/utils";
import type { ScrollIntoViewOpts } from "../types";

export type Side = "top" | "right" | "bottom" | "left";
export type Alignment = "start" | "center" | "end";
export type AllowedButtons = "next" | "previous" | "close";

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

  instruction?: HTMLElement;
  instructionIndicator?: HTMLElement;

  feedback?: HTMLElement;
};

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

  doneButton?: boolean;

  instruction?: string;
  isGated?: boolean;
  isDone?: boolean;

  feedback?: string;

  popoverClass?: string;
  smoothScroll?: boolean;
  scrollIntoView?: boolean | ScrollIntoViewOpts;

  onNextClick?: () => void;
  onPrevClick?: () => void;
  onCloseClick?: () => void;

  keepFocus?: boolean;

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

function setDisplay(element: HTMLElement, isVisible: boolean) {
  element.style.display = isVisible ? "" : "none";
}

const focusTakenFrom = new WeakSet<HTMLButtonElement>();

function focusWrapper(wrapper: HTMLElement | null) {
  wrapper?.setAttribute("tabindex", "-1");
  wrapper?.focus();
}

export function toggleButton(button: HTMLButtonElement, isDisabled: boolean) {
  const wrapper = button.closest<HTMLElement>(".driver-popover");
  if (isDisabled && document.activeElement === button) {
    focusWrapper(wrapper);
    focusTakenFrom.add(button);
  }

  button.disabled = isDisabled;
  button.classList.toggle(DISABLED_BUTTON, isDisabled);

  if (!isDisabled && focusTakenFrom.delete(button) && wrapper && document.activeElement === wrapper) {
    button.focus();
  }
}

const INSTRUCTION_TEXT = "driver-popover-instruction-text";
const DISABLED_BUTTON = "driver-popover-btn-disabled";

function toggleDescribedBy(wrapper: HTMLElement, id: string, isOn: boolean) {
  const ids = (wrapper.getAttribute("aria-describedby") || "").split(/\s+/).filter(token => token && token !== id);
  if (isOn) {
    ids.push(id);
  }

  wrapper.setAttribute("aria-describedby", ids.join(" "));
}

function insertRow(popover: PopoverDOM, className: string): HTMLElement {
  const row = createElement("div", className);

  const footer = popover.footer.parentNode === popover.wrapper ? popover.footer : null;
  popover.wrapper.insertBefore(row, footer);

  return row;
}

function createInstruction(popover: PopoverDOM) {
  const row = insertRow(popover, "driver-popover-instruction");
  const indicator = createElement("span", "driver-popover-instruction-indicator");
  indicator.setAttribute("aria-hidden", "true");
  row.append(createElement("span", INSTRUCTION_TEXT, INSTRUCTION_TEXT), indicator);

  popover.instruction = row;
  popover.instructionIndicator = indicator;
}

function applyInstruction(popover: PopoverDOM, options: PopoverRenderOptions) {
  const isGated = !!options.isGated;
  if ((isGated || options.instruction) && !popover.instruction) {
    createInstruction(popover);
  }

  const { instruction: row, instructionIndicator: indicator, wrapper, nextButton } = popover;
  if (!row || !indicator) {
    return;
  }

  const html = options.instruction || "";
  wrapper.classList.toggle("driver-popover-has-instruction", isGated);
  wrapper.classList.toggle("driver-popover-instruction-done", isGated && !!options.isDone);
  toggleDescribedBy(wrapper, INSTRUCTION_TEXT, !!html);

  const text = row.querySelector<HTMLElement>(`:scope > .${INSTRUCTION_TEXT}`);
  if (text && html) {
    setHtml(text, html);
  }
  setDisplay(row, !!html);

  if (isGated) {
    nextButton.setAttribute("aria-disabled", "true");
    nextButton.classList.add(DISABLED_BUTTON);
  } else {
    nextButton.removeAttribute("aria-disabled");
  }
}

function applyFeedback(popover: PopoverDOM, options: PopoverRenderOptions) {
  if (options.feedback && !popover.feedback) {
    popover.feedback = insertRow(popover, "driver-popover-feedback");
  }

  if (!popover.feedback) {
    return;
  }

  setHtml(popover.feedback, options.feedback || "");
  setDisplay(popover.feedback, !!options.feedback);
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
  }
  setDisplay(popover.title, !!title);

  if (description) {
    setHtml(popover.description, description);
  }
  setDisplay(popover.description, !!description);

  const showFooter = showButtons.includes("next") || showButtons.includes("previous") || showProgress;

  setDisplay(popover.closeButton, showButtons.includes("close"));
  setDisplay(popover.footer, showFooter);
  setDisplay(popover.progress, showProgress);
  setDisplay(popover.nextButton, showButtons.includes("next"));
  setDisplay(popover.previousButton, showButtons.includes("previous"));

  toggleButton(popover.nextButton, disableButtons.includes("next"));
  toggleButton(popover.previousButton, disableButtons.includes("previous"));
  toggleButton(popover.closeButton, disableButtons.includes("close"));
  applyInstruction(popover, options);
  applyFeedback(popover, options);

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

  popover.arrow.className = "driver-popover-arrow";

  onDriverClick(
    popover.wrapper,
    e => {
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
      if (popover.description.contains(target) || popover.title.contains(target)) {
        return false;
      }

      return !!target.closest(".driver-popover-prev-btn, .driver-popover-next-btn, .driver-popover-close-btn");
    }
  );

  options.onRender?.(popover);

  repositionPopover(popover, anchor, options.position);
  repositionOnImagesLoad(popover, anchor, options.position);
  if (options.scrollIntoView !== false) {
    // only as far as it takes, so it doesn't undo where the element was scrolled to
    bringInView(popoverWrapper, options.smoothScroll, { block: "nearest", inline: "nearest" });
  }

  if (!options.keepFocus) {
    focusPopover(popover);
  }

  return popover;
}

function focusPopover(popover: PopoverDOM) {
  const { nextButton, wrapper } = popover;
  const isNextUsable =
    nextButton.isConnected &&
    nextButton.style.display !== "none" &&
    !nextButton.disabled &&
    !nextButton.hasAttribute("aria-disabled");
  if (isNextUsable) {
    nextButton.focus();
  }

  if (document.activeElement !== nextButton) {
    focusWrapper(wrapper);
  }
}

const imageTargets = new WeakMap<PopoverDOM, { anchor: Element; position: PositionOptions }>();
const watchedImages = new WeakSet<HTMLImageElement>();

function repositionOnImagesLoad(popover: PopoverDOM, anchor: Element, position: PositionOptions) {
  imageTargets.set(popover, { anchor, position });

  popover.wrapper.querySelectorAll("img").forEach(image => {
    if (image.complete || watchedImages.has(image)) {
      return;
    }

    watchedImages.add(image);
    const reposition = () => {
      watchedImages.delete(image);
      const target = imageTargets.get(popover);
      if (target && popover.wrapper.isConnected) {
        repositionPopover(popover, target.anchor, target.position);
      }
    };

    image.addEventListener("load", reposition, { once: true });
    image.addEventListener("error", reposition, { once: true });
  });
}

function createElement<K extends "div" | "span" | "button">(tag: K, className: string, id?: string) {
  const element = document.createElement(tag);
  if (id) {
    element.id = id;
  }

  if (element instanceof HTMLButtonElement) {
    element.type = "button";
  }

  element.className = className;

  return element;
}

function createPopover(): PopoverDOM {
  const wrapper = createElement("div", "driver-popover");
  wrapper.setAttribute("aria-describedby", "driver-popover-description");

  const arrow = createElement("div", "driver-popover-arrow");

  const title = createElement("div", "driver-popover-title", "driver-popover-title");
  title.style.display = "none";
  title.innerText = "Popover Title";

  const description = createElement("div", "driver-popover-description", "driver-popover-description");
  description.style.display = "none";
  description.innerText = "Popover description is here";

  const closeButton = createElement("button", "driver-popover-close-btn");
  closeButton.innerHTML = "&times;";

  const footer = createElement("div", "driver-popover-footer");
  const progress = createElement("span", "driver-popover-progress-text");
  const footerButtons = createElement("span", "driver-popover-navigation-btns");

  const previousButton = createElement("button", "driver-popover-prev-btn driver-popover-footer-btn");
  previousButton.innerHTML = "Previous";

  const nextButton = createElement("button", "driver-popover-next-btn driver-popover-footer-btn");
  nextButton.innerHTML = "Next";

  footerButtons.append(previousButton, nextButton);
  footer.append(progress, footerButtons);
  wrapper.append(closeButton, arrow, title, description, footer);

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

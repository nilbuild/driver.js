import { Config, DriverHook, getConfig, getCurrentDriver } from "./config";
import { Driver, DriveStep } from "./driver";
import { emit } from "./emitter";
import { destroyDriverClick, onDriverClick } from "./events";
import { repositionPopover } from "./position";
import { getState, setState, State } from "./state";
import { bringInView, getFocusableElements } from "./utils";

export type Side = "top" | "right" | "bottom" | "left";
export type Alignment = "start" | "center" | "end";
export type AllowedButtons = "next" | "previous" | "close";

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

  // Called after the popover is rendered
  onPopoverRender?: (popover: PopoverDOM, opts: { config: Config; state: State; driver: Driver }) => void;

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

export function hidePopover() {
  const popover = getState("popover");
  if (!popover) {
    return;
  }

  popover.wrapper.style.display = "none";
}

export function renderPopover(element: Element, step: DriveStep) {
  let popover = getState("popover");
  if (popover) {
    destroyDriverClick(popover.wrapper);
    document.body.removeChild(popover.wrapper);
  }

  popover = createPopover();
  document.body.appendChild(popover.wrapper);

  const {
    title,
    description,
    showButtons,
    disableButtons,
    showProgress,

    nextBtnText = getConfig("nextBtnText") || "Next",
    prevBtnText = getConfig("prevBtnText") || "Previous",
    progressText = getConfig("progressText") || "{current} of {total}",
  } = step.popover || {};

  popover.nextButton.innerHTML = nextBtnText;
  popover.previousButton.innerHTML = prevBtnText;
  popover.progress.innerHTML = progressText;

  const steps = getConfig("steps") || [];
  const activeIndex = getState("activeIndex");
  const isDoneStep = activeIndex !== undefined && activeIndex === steps.length - 1;
  if (isDoneStep) {
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

  const showButtonsConfig: AllowedButtons[] = showButtons || getConfig("showButtons")!;
  const showProgressConfig = showProgress || getConfig("showProgress") || false;
  const showFooter =
    showButtonsConfig?.includes("next") || showButtonsConfig?.includes("previous") || showProgressConfig;

  popover.closeButton.style.display = showButtonsConfig.includes("close") ? "block" : "none";

  if (showFooter) {
    popover.footer.style.display = "flex";

    popover.progress.style.display = showProgressConfig ? "block" : "none";
    popover.nextButton.style.display = showButtonsConfig.includes("next") ? "block" : "none";
    popover.previousButton.style.display = showButtonsConfig.includes("previous") ? "block" : "none";
  } else {
    popover.footer.style.display = "none";
  }

  const disabledButtonsConfig: AllowedButtons[] = disableButtons || getConfig("disableButtons")! || [];
  if (disabledButtonsConfig?.includes("next")) {
    popover.nextButton.disabled = true;
    popover.nextButton.classList.add("driver-popover-btn-disabled");
  }

  if (disabledButtonsConfig?.includes("previous")) {
    popover.previousButton.disabled = true;
    popover.previousButton.classList.add("driver-popover-btn-disabled");
  }

  if (disabledButtonsConfig?.includes("close")) {
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
  const customPopoverClass = step.popover?.popoverClass || getConfig("popoverClass") || "";
  popoverWrapper.className = `driver-popover ${customPopoverClass}`.trim();

  // Handles the popover button clicks
  onDriverClick(
    popover.wrapper,
    e => {
      const target = e.target as HTMLElement;

      const onNextClick = step.popover?.onNextClick || getConfig("onNextClick");
      const onPrevClick = step.popover?.onPrevClick || getConfig("onPrevClick");
      const onCloseClick = step.popover?.onCloseClick || getConfig("onCloseClick");
      const onDoneClick = step.popover?.onDoneClick || getConfig("onDoneClick");

      if (!!target.closest(".driver-popover-next-btn")) {
        // On the final step the next button acts as the done button, so a
        // dedicated onDoneClick takes precedence over onNextClick when provided.
        if (isDoneStep && onDoneClick) {
          return onDoneClick(element, step, {
            config: getConfig(),
            state: getState(),
            driver: getCurrentDriver(),
          });
        }

        // If the user has provided a custom callback, call it
        // otherwise, emit the event.
        if (onNextClick) {
          return onNextClick(element, step, {
            config: getConfig(),
            state: getState(),
            driver: getCurrentDriver(),
          });
        } else {
          return emit("nextClick");
        }
      }

      if (!!target.closest(".driver-popover-prev-btn")) {
        if (onPrevClick) {
          return onPrevClick(element, step, {
            config: getConfig(),
            state: getState(),
            driver: getCurrentDriver(),
          });
        } else {
          return emit("prevClick");
        }
      }

      if (!!target.closest(".driver-popover-close-btn")) {
        if (onCloseClick) {
          return onCloseClick(element, step, {
            config: getConfig(),
            state: getState(),
            driver: getCurrentDriver(),
          });
        } else {
          return emit("closeClick");
        }
      }

      return undefined;
    },
    target => {
      // Only prevent the default action if we're clicking on a driver button.
      // This allows links inside the popover title/description, as well as
      // custom buttons added through onPopoverRender, to behave normally.
      if (popover?.description.contains(target) || popover?.title.contains(target)) {
        return false;
      }

      return !!target.closest(
        ".driver-popover-prev-btn, .driver-popover-next-btn, .driver-popover-close-btn"
      );
    }
  );

  setState("popover", popover);

  const onPopoverRender = step.popover?.onPopoverRender || getConfig("onPopoverRender");
  if (onPopoverRender) {
    onPopoverRender(popover, {
      config: getConfig(),
      state: getState(),
      driver: getCurrentDriver(),
    });
  }

  repositionPopover(element, step);
  bringInView(popoverWrapper);

  // Focus on the first focusable element in active element or popover
  const isToDummyElement = element.classList.contains("driver-dummy-element");
  const focusableElement = getFocusableElements([popoverWrapper, ...(isToDummyElement ? [] : [element])]);
  if (focusableElement.length > 0) {
    focusableElement[0].focus();
  }
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
  closeButton.setAttribute("aria-label", "Close");
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

export function destroyPopover() {
  const popover = getState("popover");
  if (!popover) {
    return;
  }

  destroyDriverClick(popover.wrapper);
  popover.wrapper.parentElement?.removeChild(popover.wrapper);
}

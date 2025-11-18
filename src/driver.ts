import { AllowedButtons, destroyPopover, Popover } from "./popover";
import { destroyOverlay } from "./overlay";
import { destroyEvents, initEvents, requireRefresh } from "./events";
import { Config, configure, DriverHook, getConfig, getCurrentDriver, setCurrentDriver } from "./config";
import { destroyHighlight, highlight } from "./highlight";
import { destroyEmitter, listen } from "./emitter";
import { getState, resetState, setState } from "./state";
import "./driver.css";

export type DriveStep = {
  element?: string | Element | (() => Element);
  onHighlightStarted?: DriverHook;
  onHighlighted?: DriverHook;
  onDeselected?: DriverHook;
  popover?: Popover;
  disableActiveInteraction?: boolean;
};

export interface Driver {
  isActive: () => boolean;
  refresh: () => void;
  drive: (stepIndex?: number) => void;
  setConfig: (config: Config) => void;
  setSteps: (steps: DriveStep[]) => void;
  getConfig: () => Config;
  getState: (key?: string) => any;
  getActiveIndex: () => number | undefined;
  isFirstStep: () => boolean;
  isLastStep: () => boolean;
  getActiveStep: () => DriveStep | undefined;
  getActiveElement: () => Element | undefined;
  getPreviousElement: () => Element | undefined;
  getPreviousStep: () => DriveStep | undefined;
  moveNext: () => void;
  movePrevious: () => void;
  moveTo: (index: number) => void;
  hasNextStep: () => boolean;
  hasPreviousStep: () => boolean;
  highlight: (step: DriveStep) => void;
  destroy: () => void;
}

export function driver(options: Config = {}): Driver {
  configure(options);

  function handleClose() {
    if (!getConfig("allowClose")) {
      return;
    }

    destroy();
  }

  function handleOverlayClick() {
    const overlayClickBehavior = getConfig("overlayClickBehavior");

    if (getConfig("allowClose") && overlayClickBehavior === "close") {
      destroy();
      return;
    }

    if (typeof overlayClickBehavior === "function") {
      const activeStep = getState("__activeStep");
      const activeElement = getState("__activeElement");

      overlayClickBehavior(activeElement, activeStep!, {
        config: getConfig(),
        state: getState(),
        driver: getCurrentDriver(),
      });

      return;
    }

    if (overlayClickBehavior === "nextStep") {
      moveNext();
    }
  }

  function moveNext() {
    const activeIndex = getState("activeIndex");
    const steps = getConfig("steps") || [];
    if (typeof activeIndex === "undefined") {
      return;
    }

    const nextStepIndex = activeIndex + 1;
    if (steps[nextStepIndex]) {
      drive(nextStepIndex);
    } else {
      destroy();
    }
  }

  function movePrevious() {
    const activeIndex = getState("activeIndex");
    const steps = getConfig("steps") || [];
    if (typeof activeIndex === "undefined") {
      return;
    }

    const previousStepIndex = activeIndex - 1;
    if (steps[previousStepIndex]) {
      drive(previousStepIndex);
    } else {
      destroy();
    }
  }

  function moveTo(index: number) {
    const steps = getConfig("steps") || [];

    if (steps[index]) {
      drive(index);
    } else {
      destroy();
    }
  }

  function handleArrowLeft() {
    const isTransitioning = getState("__transitionCallback");
    if (isTransitioning) {
      return;
    }

    const activeIndex = getState("activeIndex");
    const activeStep = getState("__activeStep");
    const activeElement = getState("__activeElement");
    if (typeof activeIndex === "undefined" || typeof activeStep === "undefined") {
      return;
    }

    const currentStepIndex = getState("activeIndex");
    if (typeof currentStepIndex === "undefined") {
      return;
    }

    const onPrevClick = activeStep.popover?.onPrevClick || getConfig("onPrevClick");
    if (onPrevClick) {
      return onPrevClick(activeElement, activeStep, {
        config: getConfig(),
        state: getState(),
        driver: getCurrentDriver(),
      });
    }

    movePrevious();
  }

  function handleArrowRight() {
    const isTransitioning = getState("__transitionCallback");
    if (isTransitioning) {
      return;
    }

    const activeIndex = getState("activeIndex");
    const activeStep = getState("__activeStep");
    const activeElement = getState("__activeElement");
    if (typeof activeIndex === "undefined" || typeof activeStep === "undefined") {
      return;
    }

    const onNextClick = activeStep.popover?.onNextClick || getConfig("onNextClick");
    if (onNextClick) {
      return onNextClick(activeElement, activeStep, {
        config: getConfig(),
        state: getState(),
        driver: getCurrentDriver(),
      });
    }

    moveNext();
  }

  function init() {
    if (getState("isInitialized")) {
      return;
    }

    setState("isInitialized", true);
    document.body.classList.add("driver-active", getConfig("animate") ? "driver-fade" : "driver-simple");

    initEvents();

    listen("overlayClick", handleOverlayClick);
    listen("escapePress", handleClose);
    listen("arrowLeftPress", handleArrowLeft);
    listen("arrowRightPress", handleArrowRight);
  }

  function drive(stepIndex: number = 0) {
    const steps = getConfig("steps");
    if (!steps) {
      console.error("No steps to drive through");
      destroy();
      return;
    }

    if (!steps[stepIndex]) {
      destroy();

      return;
    }

    setState("__activeOnDestroyed", document.activeElement as HTMLElement);
    setState("activeIndex", stepIndex);

    const currentStep = steps[stepIndex];
    const hasNextStep = steps[stepIndex + 1];
    const hasPreviousStep = steps[stepIndex - 1];

    const doneBtnText = currentStep.popover?.doneBtnText || getConfig("doneBtnText") || "Done";
    const allowsClosing = getConfig("allowClose");
    const showProgress =
      typeof currentStep.popover?.showProgress !== "undefined"
        ? currentStep.popover?.showProgress
        : getConfig("showProgress");
    const progressText = currentStep.popover?.progressText || getConfig("progressText") || "{{current}} of {{total}}";
    const progressTextReplaced = progressText
      .replace("{{current}}", `${stepIndex + 1}`)
      .replace("{{total}}", `${steps.length}`);

    const configuredButtons = currentStep.popover?.showButtons || getConfig("showButtons");
    const calculatedButtons: AllowedButtons[] = [
      "next",
      "previous",
      ...(allowsClosing ? ["close" as AllowedButtons] : []),
    ].filter(b => {
      return !configuredButtons?.length || configuredButtons.includes(b as AllowedButtons);
    }) as AllowedButtons[];

    const onNextClick = currentStep.popover?.onNextClick || getConfig("onNextClick");
    const onPrevClick = currentStep.popover?.onPrevClick || getConfig("onPrevClick");
    const onCloseClick = currentStep.popover?.onCloseClick || getConfig("onCloseClick");

    highlight({
      ...currentStep,
      popover: {
        showButtons: calculatedButtons,
        nextBtnText: !hasNextStep ? doneBtnText : undefined,
        disableButtons: [...(!hasPreviousStep ? ["previous" as AllowedButtons] : [])],
        showProgress: showProgress,
        progressText: progressTextReplaced,
        onNextClick: onNextClick
          ? onNextClick
          : () => {
              if (!hasNextStep) {
                destroy();
              } else {
                drive(stepIndex + 1);
              }
            },
        onPrevClick: onPrevClick
          ? onPrevClick
          : () => {
              drive(stepIndex - 1);
            },
        onCloseClick: onCloseClick
          ? onCloseClick
          : () => {
              destroy();
            },
        ...(currentStep?.popover || {}),
      },
    });
  }

  function destroy(withOnDestroyStartedHook = true) {
    const activeElement = getState("__activeElement");
    const activeStep = getState("__activeStep");

    const activeOnDestroyed = getState("__activeOnDestroyed");

    const onDestroyStarted = getConfig("onDestroyStarted");
    // `onDestroyStarted` is used to confirm the exit of tour. If we trigger
    // the hook for when user calls `destroy`, driver will get into infinite loop
    // not causing tour to be destroyed.
    if (withOnDestroyStartedHook && onDestroyStarted) {
      const isActiveDummyElement = !activeElement || activeElement?.id === "driver-dummy-element";
      onDestroyStarted(isActiveDummyElement ? undefined : activeElement, activeStep!, {
        config: getConfig(),
        state: getState(),
        driver: getCurrentDriver(),
      });
      return;
    }

    const onDeselected = activeStep?.onDeselected || getConfig("onDeselected");
    const onDestroyed = getConfig("onDestroyed");

    document.body.classList.remove("driver-active", "driver-fade", "driver-simple");

    destroyEvents();
    destroyPopover();
    destroyHighlight();
    destroyOverlay();
    destroyEmitter();

    resetState();

    if (activeElement && activeStep) {
      const isActiveDummyElement = activeElement.id === "driver-dummy-element";
      if (onDeselected) {
        onDeselected(isActiveDummyElement ? undefined : activeElement, activeStep, {
          config: getConfig(),
          state: getState(),
          driver: getCurrentDriver(),
        });
      }

      if (onDestroyed) {
        onDestroyed(isActiveDummyElement ? undefined : activeElement, activeStep, {
          config: getConfig(),
          state: getState(),
          driver: getCurrentDriver(),
        });
      }
    }

    if (activeOnDestroyed) {
      (activeOnDestroyed as HTMLElement).focus();
    }
  }

  const api: Driver = {
    isActive: () => getState("isInitialized") || false,
    refresh: requireRefresh,
    drive: (stepIndex: number = 0) => {
      init();
      drive(stepIndex);
    },
    setConfig: configure,
    setSteps: (steps: DriveStep[]) => {
      resetState();
      configure({
        ...getConfig(),
        steps,
      });
    },
    getConfig,
    getState,
    getActiveIndex: () => getState("activeIndex"),
    isFirstStep: () => getState("activeIndex") === 0,
    isLastStep: () => {
      const steps = getConfig("steps") || [];
      const activeIndex = getState("activeIndex");

      return activeIndex !== undefined && activeIndex === steps.length - 1;
    },
    getActiveStep: () => getState("activeStep"),
    getActiveElement: () => getState("activeElement"),
    getPreviousElement: () => getState("previousElement"),
    getPreviousStep: () => getState("previousStep"),
    moveNext,
    movePrevious,
    moveTo,
    hasNextStep: () => {
      const steps = getConfig("steps") || [];
      const activeIndex = getState("activeIndex");

      return activeIndex !== undefined && !!steps[activeIndex + 1];
    },
    hasPreviousStep: () => {
      const steps = getConfig("steps") || [];
      const activeIndex = getState("activeIndex");

      return activeIndex !== undefined && !!steps[activeIndex - 1];
    },
    highlight: (step: DriveStep) => {
      init();
      highlight({
        ...step,
        popover: step.popover
          ? {
              showButtons: [],
              showProgress: false,
              progressText: "",
              ...step.popover!,
            }
          : undefined,
      });
    },
    destroy: () => {
      destroy(false);
    },
  };

  setCurrentDriver(api);

  return api;
}

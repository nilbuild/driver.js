import { driver, type Config, type DriveStep, type WaitingForElementHook, type WaitingForElementOpts } from "driver.js";
import { driver as headless, type Driver as HeadlessDriver } from "driver.js/headless";

const onWaitingForElement: WaitingForElementHook = (element, step, opts) => {
  const options: WaitingForElementOpts = opts;
  const signal: AbortSignal = opts.signal;
  void [element, step, options, signal];
};

const steps: DriveStep[] = [
  {
    element: "#a",
    scrollIntoView: false,
    onWaitingForElement,
    onElementReplaced: (element, step) => void [element, step],
  },
  { element: "#b", scrollIntoView: true, waitForElement: 3000 },
];

const config: Config = { steps, scrollIntoView: false, onWaitingForElement };
driver(config).drive();

const guide: HeadlessDriver = headless({
  steps,
  onHighlighted: (element, step) => void [element, step],
});
guide.drive();
const element: Element | undefined = guide.getActiveElement();
void element;

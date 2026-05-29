import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, Driver } from "../src/driver";

type Listener = (event: any) => void;

class TestClassList {
  private classes = new Set<string>();

  constructor(private element: TestElement) {}

  add(...classes: string[]) {
    classes.forEach(className => this.classes.add(className));
    this.sync();
  }

  remove(...classes: string[]) {
    classes.forEach(className => this.classes.delete(className));
    this.sync();
  }

  contains(className: string) {
    return this.classes.has(className);
  }

  set(value: string) {
    this.classes = new Set(value.split(" ").filter(Boolean));
    this.sync();
  }

  toString() {
    return Array.from(this.classes).join(" ");
  }

  private sync() {
    this.element.className = this.toString();
  }
}

class TestElement {
  attributes: Record<string, string> = {};
  children: TestElement[] = [];
  classList: TestClassList;
  className = "";
  disabled = false;
  id = "";
  innerHTML = "";
  innerText = "";
  offsetHeight = 10;
  offsetWidth = 10;
  parentElement?: TestElement;
  scrollHeight = 10;
  clientHeight = 10;
  style: Record<string, string> = {};
  type = "";

  constructor(public tagName: string) {
    this.tagName = tagName.toUpperCase();
    this.classList = new TestClassList(this);
  }

  appendChild(child: TestElement) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  removeChild(child: TestElement) {
    this.children = this.children.filter(currentChild => currentChild !== child);
    child.parentElement = undefined;
    return child;
  }

  remove() {
    this.parentElement?.removeChild(this);
  }

  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }

  removeAttribute(name: string) {
    delete this.attributes[name];
  }

  contains(target: TestElement): boolean {
    return this === target || this.children.some(child => child.contains(target));
  }

  closest(selector: string) {
    if (!selector.startsWith(".")) {
      return undefined;
    }

    const className = selector.slice(1);
    let element: TestElement | undefined = this;
    while (element) {
      if (element.classList.contains(className)) {
        return element;
      }

      element = element.parentElement;
    }

    return undefined;
  }

  matches(selector: string) {
    return selector.includes("button:not([disabled])") && this.tagName === "BUTTON" && !this.disabled;
  }

  querySelector(selector: string) {
    return this.querySelectorAll(selector)[0];
  }

  querySelectorAll(selector: string) {
    const matches = (element: TestElement) => {
      if (selector.startsWith(".")) {
        return element.classList.contains(selector.slice(1));
      }

      if (selector.startsWith("#")) {
        return element.id === selector.slice(1);
      }

      return element.matches(selector);
    };

    return this.walk().filter(matches);
  }

  getBoundingClientRect() {
    return {
      bottom: 10,
      height: 10,
      left: 0,
      right: 10,
      top: 0,
      width: 10,
      x: 0,
      y: 0,
    };
  }

  getClientRects() {
    return [this.getBoundingClientRect()];
  }

  scrollIntoView() {}

  focus() {
    (globalThis.document as any).activeElement = this;
  }

  click() {
    const event = {
      target: this,
      preventDefault: vi.fn(),
      stopImmediatePropagation: vi.fn(),
      stopPropagation: vi.fn(),
    };

    (globalThis.document as any).emit("click", event);
  }

  private walk(): TestElement[] {
    return this.children.flatMap(child => [child, ...child.walk()]);
  }
}

class TestDocument {
  activeElement?: TestElement;
  body = new TestElement("body");
  documentElement = new TestElement("html");
  private listeners: Record<string, Listener[]> = {};

  createElement(tagName: string) {
    return new TestElement(tagName);
  }

  createElementNS(_: string, tagName: string) {
    return new TestElement(tagName);
  }

  getElementById(id: string) {
    return this.body.querySelector(`#${id}`);
  }

  querySelector(selector: string) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector: string) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener(eventName: string, listener: Listener) {
    this.listeners[eventName] ||= [];
    this.listeners[eventName].push(listener);
  }

  removeEventListener(eventName: string, listener: Listener) {
    this.listeners[eventName] = (this.listeners[eventName] || []).filter(current => current !== listener);
  }

  emit(eventName: string, event: any) {
    (this.listeners[eventName] || []).forEach(listener => listener(event));
  }
}

function setupDom() {
  const document = new TestDocument();
  const first = document.createElement("button");
  first.id = "first";
  const second = document.createElement("button");
  second.id = "second";

  document.body.appendChild(first);
  document.body.appendChild(second);

  vi.stubGlobal("document", document);
  vi.stubGlobal("window", {
    addEventListener: vi.fn(),
    cancelAnimationFrame: vi.fn(),
    innerHeight: 768,
    innerWidth: 1024,
    removeEventListener: vi.fn(),
    requestAnimationFrame: vi.fn(),
  });
  vi.stubGlobal("getComputedStyle", () => ({ pointerEvents: "auto" }));
}

function setupTour(options: Parameters<typeof driver>[0] = {}) {
  const driverObj = driver({
    animate: false,
    steps: [
      {
        element: "#first",
        popover: {
          title: "First step",
        },
      },
      {
        element: "#second",
        popover: {
          title: "Second step",
        },
      },
    ],
    ...options,
  });

  driverObj.drive();

  return driverObj;
}

function getSkipButton() {
  return document.querySelector(".driver-popover-skip-btn") as HTMLButtonElement | undefined;
}

describe("skip button", () => {
  let driverObj: Driver | undefined;

  beforeEach(() => {
    setupDom();
  });

  afterEach(() => {
    driverObj?.destroy();
    driverObj = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders in the footer and destroys the active tour", () => {
    driverObj = setupTour({
      showButtons: ["skip", "previous", "next"],
    });

    const skipButton = getSkipButton();

    expect(skipButton).toBeTruthy();
    expect(skipButton?.style.display).toBe("block");

    skipButton?.click();

    expect(driverObj.isActive()).toBe(false);
  });

  it("uses configured skip button text", () => {
    driverObj = setupTour({
      showButtons: ["skip", "previous", "next"],
      skipBtnText: "Skip setup",
    });

    expect(getSkipButton()?.innerHTML).toBe("Skip setup");
  });

  it("calls onSkipClick instead of destroying by default", () => {
    const onSkipClick = vi.fn();

    driverObj = setupTour({
      showButtons: ["skip", "previous", "next"],
      onSkipClick,
    });

    getSkipButton()?.click();

    expect(onSkipClick).toHaveBeenCalledTimes(1);
    expect(driverObj.isActive()).toBe(true);
  });

  it("hides the skip button when closing is not allowed", () => {
    driverObj = setupTour({
      allowClose: false,
      showButtons: ["skip", "previous", "next"],
    });

    expect(getSkipButton()?.style.display).toBe("none");
  });
});

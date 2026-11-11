import { afterEach, beforeEach } from "vitest";
import { driver, type Config, type DriveStep, type Driver } from "../src/driver";

type DriverConfig = Parameters<typeof driver>[0];

export const DEMO_HTML = `
  <header class="page-header"><h1>Title</h1></header>
  <p id="intro">Intro paragraph</p>
  <button id="card-1" type="button">Card One</button>
  <ul class="feature-list"><li>One</li></ul>
`;

export const SAMPLE_STEPS: DriveStep[] = [
  { element: "#intro", popover: { title: "Step 1", description: "First" } },
  { element: "#card-1", popover: { title: "Step 2", description: "Second" } },
  { element: ".feature-list", popover: { title: "Step 3", description: "Third" } },
];

let active: Driver | undefined;

export function createDriver(config?: DriverConfig): Driver {
  active = driver(config);
  return active;
}

export function useDriverHarness(): void {
  beforeEach(() => {
    document.body.innerHTML = DEMO_HTML;
  });

  afterEach(() => {
    active?.destroy();
    active = undefined;
    document.body.innerHTML = "";
  });
}

export function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

export const tick = (ms = 10) => new Promise(resolve => setTimeout(resolve, ms));

export function append(id: string, tag = "button"): HTMLElement {
  const element = document.createElement(tag);
  element.id = id;
  document.body.appendChild(element);
  return element;
}

export const popoverEl = () => document.querySelector(".driver-popover");
export const popoverTitle = () => document.querySelector(".driver-popover-title")?.textContent?.trim();
export const popoverDescription = () => document.querySelector(".driver-popover-description")?.textContent?.trim();
export const progressText = () => document.querySelector(".driver-popover-progress-text")?.textContent?.trim();
export const navButton = (which: "next" | "prev" | "close") =>
  document.querySelector<HTMLButtonElement>(`.driver-popover-${which}-btn`);

export function pressKey(key: string): void {
  window.dispatchEvent(new KeyboardEvent("keyup", { key }));
}

const TRACED_HOOKS = [
  "onDeselected",
  "onHighlightStarted",
  "onHighlighted",
  "onDestroyStarted",
  "onDestroyed",
] as const;
type HookName = (typeof TRACED_HOOKS)[number];

export function traced(config: Config = {}, inside: Partial<Record<HookName, (title: string) => void>> = {}) {
  const trace: string[] = [];
  const hooks: Config = {};
  for (const name of TRACED_HOOKS) {
    hooks[name] = (element, step, opts) => {
      const title = step?.popover?.title ?? "none";
      const reason = opts.reason ? ` (${opts.reason})` : "";
      trace.push(`${name}:${title}:${element ? (element as HTMLElement).id || element.tagName : "none"}${reason}`);
      inside[name]?.(title);
    };
  }

  const d = createDriver({ animate: false, steps: SAMPLE_STEPS, ...hooks, ...config });

  return { d, trace };
}

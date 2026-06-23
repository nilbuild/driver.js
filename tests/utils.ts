import { afterEach, beforeEach } from "vitest";
import { driver, type DriveStep, type Driver } from "../src/driver";

type DriverConfig = Parameters<typeof driver>[0];

// A small, stable DOM that the tests highlight against.
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

// Resets the DOM before each test and tears the driver down after, so the
// library's module-level state never leaks between tests. Call once per file.
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

// Waits a single animation frame — needed for hooks that fire in the rAF loop.
export function nextFrame(): Promise<void> {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
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

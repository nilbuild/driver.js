import { expect, type Locator, type Page } from "@playwright/test";
import type { driver, Driver } from "driver.js";
import type { hints } from "driver.js/hints";
import type { checklist } from "driver.js/checklist";

declare global {
  interface Window {
    driverjs: { driver: typeof driver; hints: typeof hints; checklist: typeof checklist };
    tour: Driver;
    log: string[];
  }
}

export const popover = (page: Page) => page.locator(".driver-popover");
export const title = (page: Page) => page.locator(".driver-popover-title");
export const description = (page: Page) => page.locator(".driver-popover-description");
export const overlay = (page: Page) => page.locator(".driver-overlay");
export const nextButton = (page: Page) => page.locator(".driver-popover-next-btn");
export const prevButton = (page: Page) => page.locator(".driver-popover-prev-btn");
export const closeButton = (page: Page) => page.locator(".driver-popover-close-btn");

export async function openFixture(page: Page) {
  await page.goto("/e2e");
  await page.locator("html[data-ready=true]").waitFor();
}

export const settle = (page: Page) =>
  page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));

export const log = (page: Page) => page.evaluate(() => window.log);

export const activeIndex = (page: Page) => page.evaluate(() => window.tour.getActiveIndex());

export async function record(page: Page, selector: string | null, types: string[]) {
  await page.evaluate(
    ({ selector, types }) => {
      const target = selector ? document.querySelector(selector)! : document;
      const name = selector || "document";
      for (const type of types) {
        target.addEventListener(type, () => window.log.push(`${type}@${name}`));
      }
    },
    { selector, types }
  );
}

export async function box(locator: Locator) {
  const result = await locator.boundingBox();
  expect(result).not.toBeNull();

  return result!;
}

export const topElementAt = (page: Page, x: number, y: number) =>
  page.evaluate(
    ({ x, y }) => {
      const element = document.elementFromPoint(x, y);
      if (!element) {
        return "none";
      }

      return element.id || (element.closest(".driver-overlay") ? "overlay" : element.tagName.toLowerCase());
    },
    { x, y }
  );

export const isActive = (page: Page) => page.evaluate(() => window.tour.isActive());

export const clearLog = (page: Page) => page.evaluate(() => void window.log.splice(0));

export const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThan(2);

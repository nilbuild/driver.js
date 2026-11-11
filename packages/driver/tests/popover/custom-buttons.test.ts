import { readFileSync } from "fs";
import { resolve } from "path";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { createDriver, navButton, SAMPLE_STEPS, useDriverHarness } from "../utils";

useDriverHarness();

beforeAll(() => {
  const style = document.createElement("style");
  style.textContent = readFileSync(resolve(process.cwd(), "src/styles/popover.css"), "utf8");
  document.head.appendChild(style);
});

afterEach(() => {
  vi.restoreAllMocks();
});

function addCustomFooterButton(opts: { keepDefaultStyle: boolean }): {
  button: HTMLButtonElement;
  onClick: ReturnType<typeof vi.fn>;
} {
  const onClick = vi.fn();
  const button = document.createElement("button");
  button.id = "custom-footer-btn";
  button.innerText = "Custom";
  if (opts.keepDefaultStyle) {
    button.classList.add("driver-popover-footer-btn");
  }
  button.addEventListener("click", onClick);

  const d = createDriver({
    animate: false,
    steps: SAMPLE_STEPS,
    onPopoverRender: popover => {
      popover.footerButtons.appendChild(button);
    },
  });
  d.drive();

  return { button, onClick };
}

describe("footer button styling", () => {
  it("styles the built-in navigation buttons through the footer button class", () => {
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS });
    d.drive();

    const next = navButton("next")!;
    expect(next.classList.contains("driver-popover-footer-btn")).toBe(true);
    expect(navButton("prev")!.classList.contains("driver-popover-footer-btn")).toBe(true);

    const styles = getComputedStyle(next);
    expect(styles.padding).toBe("3px 7px");
    expect(styles.borderRadius).toBe("3px");
  });

  it("lets a custom footer button opt out of the default button styling", () => {
    const { button } = addCustomFooterButton({ keepDefaultStyle: false });

    const styles = getComputedStyle(button);
    expect(styles.padding).not.toBe("3px 7px");
    expect(styles.borderRadius).not.toBe("3px");
  });

  it("lets a custom footer button opt in to the default button styling", () => {
    const { button } = addCustomFooterButton({ keepDefaultStyle: true });

    const styles = getComputedStyle(button);
    expect(styles.padding).toBe("3px 7px");
    expect(styles.borderRadius).toBe("3px");
  });
});

describe("custom footer button click handling", () => {
  it("does not swallow clicks on a custom footer button that opted in to the style", () => {
    const { button, onClick } = addCustomFooterButton({ keepDefaultStyle: true });

    button.click();

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0][0].defaultPrevented).toBe(false);
  });

  it("still intercepts clicks on the built-in navigation buttons", () => {
    const onNextClick = vi.fn();
    const d = createDriver({ animate: false, steps: SAMPLE_STEPS, onNextClick });
    d.drive();

    let click: Event | undefined;
    window.addEventListener("click", event => (click = event), { capture: true, once: true });
    navButton("next")!.click();

    expect(onNextClick).toHaveBeenCalledTimes(1);
    expect(click?.defaultPrevented).toBe(true);
  });
});

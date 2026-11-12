import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type Driver } from "../../src/driver";
import { hints, type DriverHint, type Hints } from "../../src/hints";
import { DEMO_HTML, nextFrame } from "../utils";

const SAMPLE_HINTS: DriverHint[] = [
  { element: "#intro", id: "intro", popover: { title: "Intro hint", description: "About the intro" } },
  { element: "#card-1", id: "card", popover: { title: "Card hint" } },
];

let active: Hints | undefined;
let activeDriver: Driver | undefined;

function createHints(config?: Parameters<typeof hints>[0]): Hints {
  active = hints(config);
  return active;
}

const beacons = () => Array.from(document.querySelectorAll<HTMLButtonElement>(".driver-hint"));
const beaconFor = (id: string) => beacons()[SAMPLE_HINTS.findIndex(hint => hint.id === id)];
const popoverEl = () => document.querySelector<HTMLElement>(".driver-popover");
const popoverTitle = () => document.querySelector(".driver-popover-title")?.textContent?.trim();
const dismissButton = () => document.querySelector<HTMLButtonElement>(".driver-popover-next-btn");

beforeEach(() => {
  document.body.innerHTML = DEMO_HTML;
});

afterEach(() => {
  active?.hide();
  active = undefined;
  activeDriver?.destroy();
  activeDriver = undefined;
  document.body.innerHTML = "";
});

describe("mounting beacons", () => {
  it("mounts a beacon per hint, and only on show()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    expect(beacons()).toHaveLength(0);

    productHints.show();

    expect(beacons()).toHaveLength(2);
  });

  it("renders the beacon as a labelled button with a dot and a pulse", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    const beacon = beaconFor("intro");
    expect(beacon.tagName).toBe("BUTTON");
    expect(beacon.type).toBe("button");
    expect(beacon.getAttribute("aria-label")).toBe("Intro hint");
    expect(beacon.getAttribute("aria-haspopup")).toBe("dialog");
    expect(beacon.getAttribute("aria-expanded")).toBe("false");
    expect(beacon.querySelector(".driver-hint-dot")).not.toBeNull();
    expect(beacon.querySelector(".driver-hint-pulse")).not.toBeNull();
  });

  it("falls back to a generic label when the hint has no title", () => {
    createHints({ hints: [{ element: "#intro" }] }).show();

    expect(beacons()[0].getAttribute("aria-label")).toBe("Show hint");
  });

  it("skips a hint whose element does not exist", () => {
    createHints({ hints: [{ element: "#nope" }, { element: "#intro" }] }).show();

    expect(beacons()).toHaveLength(1);
  });

  it("picks up an element that appears later on show()", () => {
    const productHints = createHints({ hints: [{ element: "#late" }, ...SAMPLE_HINTS] });
    productHints.show();
    expect(beacons()).toHaveLength(2);

    const late = document.createElement("div");
    late.id = "late";
    document.body.appendChild(late);
    productHints.show();

    expect(beacons()).toHaveLength(3);
  });

  it("resolves an element node and a function element", () => {
    createHints({
      hints: [{ element: document.querySelector("#intro")! }, { element: () => document.querySelector("#card-1")! }],
    }).show();

    expect(beacons()).toHaveLength(2);
  });

  it("is idempotent across repeated show() calls", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.show();

    expect(beacons()).toHaveLength(2);
  });

  it("opts a beacon out of the pulse animation", () => {
    createHints({ hints: [{ element: "#intro", beacon: { animate: false } }] }).show();

    expect(beacons()[0].classList.contains("driver-hint-no-animation")).toBe(true);
  });

  it("applies a custom beacon class over the global default", () => {
    createHints({
      beacon: { className: "global-beacon" },
      hints: [{ element: "#intro", beacon: { className: "hint-beacon" } }, { element: "#card-1" }],
    }).show();

    expect(beacons()[0].classList.contains("hint-beacon")).toBe(true);
    expect(beacons()[1].classList.contains("global-beacon")).toBe(true);
  });

  it("keeps mounting in <body> outside a dialog", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    expect(beacons()[0].parentElement).toBe(document.body);
  });
});

describe("overlay", () => {
  const overlayEl = () => document.querySelector<SVGSVGElement>(".driver-hint-overlay");
  const overlayPath = () => overlayEl()?.querySelector("path");

  it("shows no overlay by default", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.open("intro");

    expect(overlayEl()).toBeNull();
  });

  it("dims the page while a hint is open when enabled", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();

    expect(overlayEl()).toBeNull();

    productHints.open("intro");
    expect(overlayEl()).not.toBeNull();

    productHints.close();
    expect(overlayEl()).toBeNull();
  });

  it("keeps a single overlay when swapping between hints", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();

    productHints.open("intro");
    productHints.open("card");

    expect(document.querySelectorAll(".driver-hint-overlay")).toHaveLength(1);
  });

  it("applies the configured color and opacity", () => {
    const productHints = createHints({
      hints: SAMPLE_HINTS,
      overlay: true,
      overlayColor: "#123456",
      overlayOpacity: 0.4,
    });
    productHints.show();
    productHints.open("intro");

    expect(["#123456", "rgb(18, 52, 86)"]).toContain(overlayPath()?.style.fill);
    expect(overlayPath()?.style.opacity).toBe("0.4");
  });

  it.each(["dismiss", "hide"] as const)("removes the overlay on %s()", method => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    productHints[method]("intro");

    expect(overlayEl()).toBeNull();
  });

  it("hides the beacon while its popover is open, and restores it on close", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();

    productHints.open("intro");
    expect(beaconFor("intro").style.display).toBe("none");

    productHints.close();
    expect(beaconFor("intro").style.display).toBe("");
  });

  it("keeps the beacon visible when the overlay is disabled", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    productHints.open("intro");

    expect(beaconFor("intro").style.display).not.toBe("none");
  });
});

describe("opening and closing", () => {
  it("opens the popover when the beacon is clicked", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    beaconFor("intro").click();

    expect(popoverTitle()).toBe("Intro hint");
    expect(beaconFor("intro").getAttribute("aria-expanded")).toBe("true");
  });

  it("toggles closed when the same beacon is clicked again", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    beaconFor("intro").click();
    beaconFor("intro").click();

    expect(popoverEl()).toBeNull();
    expect(beaconFor("intro").getAttribute("aria-expanded")).toBe("false");
  });

  it("swaps the popover when another beacon is clicked", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    beaconFor("intro").click();
    beaconFor("card").click();

    expect(document.querySelectorAll(".driver-popover")).toHaveLength(1);
    expect(popoverTitle()).toBe("Card hint");
    expect(beaconFor("intro").getAttribute("aria-expanded")).toBe("false");
    expect(beaconFor("card").getAttribute("aria-expanded")).toBe("true");
  });

  it("keeps the beacons interactive with no overlay behind them", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    expect(document.querySelector(".driver-overlay")).toBeNull();
    expect(document.body.classList.contains("driver-active")).toBe(false);
  });

  it("opens and closes programmatically", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    productHints.open("card");
    expect(popoverTitle()).toBe("Card hint");
    expect(productHints.getActive()?.id).toBe("card");

    productHints.close();
    expect(popoverEl()).toBeNull();
    expect(productHints.getActive()).toBeUndefined();
  });

  it("addresses a hint without an id by its index", () => {
    const productHints = createHints({ hints: [{ element: "#intro", popover: { title: "First" } }] });
    productHints.show();

    productHints.open(0);

    expect(popoverTitle()).toBe("First");
  });

  it("ignores an unknown id", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    expect(() => productHints.open("nope")).not.toThrow();
    expect(popoverEl()).toBeNull();
  });
});

describe("dismissing", () => {
  it("shows a Got it button by default", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    expect(dismissButton()?.innerHTML).toBe("Got it");
    expect(dismissButton()?.style.display).toBe("");
  });

  it("uses custom button text from the hint over the global default", () => {
    createHints({
      buttonText: "Global OK",
      hints: [{ element: "#intro", popover: { title: "One", buttonText: "Hint OK" } }, { element: "#card-1" }],
    }).show();

    beacons()[0].click();
    expect(dismissButton()?.innerHTML).toBe("Hint OK");

    beacons()[1].click();
    expect(dismissButton()?.innerHTML).toBe("Global OK");
  });

  it("hides the dismiss button when showButton is false", () => {
    createHints({ hints: [{ element: "#intro", popover: { title: "One", showButton: false } }] }).show();
    beacons()[0].click();

    expect(document.querySelector<HTMLElement>(".driver-popover-footer")?.style.display).toBe("none");
  });

  it("renders no navigation or close buttons", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    expect(document.querySelector<HTMLElement>(".driver-popover-prev-btn")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-close-btn")?.style.display).toBe("none");
    expect(document.querySelector<HTMLElement>(".driver-popover-progress-text")?.style.display).toBe("none");
  });

  it("removes the beacon and popover when dismissed", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    dismissButton()!.click();

    expect(popoverEl()).toBeNull();
    expect(beacons()).toHaveLength(1);
  });

  it("keeps the beacon when the popover is merely closed", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    beaconFor("intro").click();

    productHints.close();

    expect(popoverEl()).toBeNull();
    expect(beacons()).toHaveLength(2);
  });

  it("does not resurrect a dismissed hint on hide/show", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.dismiss("intro");

    productHints.hide();
    productHints.show();

    expect(beacons()).toHaveLength(1);
    expect(beacons()[0].getAttribute("aria-label")).toBe("Card hint");
  });

  it("brings a dismissed hint back with restore()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.dismiss("intro");
    expect(beacons()).toHaveLength(1);

    productHints.restore("intro");

    expect(beacons()).toHaveLength(2);
  });

  it("brings every dismissed hint back with restoreAll()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.dismiss("intro");
    productHints.dismiss("card");
    expect(beacons()).toHaveLength(0);

    productHints.restoreAll();

    expect(beacons()).toHaveLength(2);
  });

  it("clears dismissals for the next show() when hidden", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.dismiss("intro");
    productHints.hide();

    productHints.restoreAll();
    productHints.show();

    expect(beacons()).toHaveLength(2);
  });

  it("ignores restore() for a hint that was never dismissed", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    productHints.restore("intro");

    expect(beacons()).toHaveLength(2);
  });

  it("resets dismissals on setHints()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.dismiss("intro");

    productHints.setHints(SAMPLE_HINTS);

    expect(beacons()).toHaveLength(2);
  });
});

describe("hooks", () => {
  it("fires onOpen with the element, hint and instance", () => {
    const onOpen = vi.fn();
    const productHints = createHints({ hints: SAMPLE_HINTS, onOpen });
    productHints.show();

    beaconFor("intro").click();

    expect(onOpen).toHaveBeenCalledTimes(1);
    const [element, hint, opts] = onOpen.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(hint.id).toBe("intro");
    expect(opts.hints).toBe(productHints);
    expect(opts.config.hints).toBe(SAMPLE_HINTS);
  });

  it("prefers a hint-level onOpen over the global one", () => {
    const globalOpen = vi.fn();
    const hintOpen = vi.fn();
    createHints({ hints: [{ element: "#intro", onOpen: hintOpen }], onOpen: globalOpen }).show();

    beacons()[0].click();

    expect(hintOpen).toHaveBeenCalledTimes(1);
    expect(globalOpen).not.toHaveBeenCalled();
  });

  it("fires onOpen for a programmatic open", () => {
    const onOpen = vi.fn();
    const productHints = createHints({ hints: SAMPLE_HINTS, onOpen });
    productHints.show();

    productHints.open("intro");

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("fires onDismiss with a stable id for persistence", () => {
    const onDismiss = vi.fn();
    createHints({ hints: SAMPLE_HINTS, onDismiss }).show();

    beaconFor("intro").click();
    dismissButton()!.click();

    expect(onDismiss).toHaveBeenCalledTimes(1);
    const [element, hint] = onDismiss.mock.calls[0];
    expect(element).toBe(document.querySelector("#intro"));
    expect(hint.id).toBe("intro");
  });

  it("runs onButtonClick instead of dismissing when provided", () => {
    const onButtonClick = vi.fn();
    const onDismiss = vi.fn();
    createHints({
      onDismiss,
      hints: [{ element: "#intro", id: "intro", popover: { title: "One", onButtonClick } }, SAMPLE_HINTS[1]],
    }).show();

    beacons()[0].click();
    dismissButton()!.click();

    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    expect(beacons()).toHaveLength(2);
    expect(popoverEl()).not.toBeNull();
  });

  it("falls back to the instance-level onButtonClick", () => {
    const onButtonClick = vi.fn();
    const productHints = createHints({ hints: SAMPLE_HINTS, onButtonClick });
    productHints.show();

    beaconFor("intro").click();
    dismissButton()!.click();

    expect(onButtonClick).toHaveBeenCalledTimes(1);
    expect(beacons()).toHaveLength(2);
  });

  it("lets onButtonClick dismiss through the instance", () => {
    const productHints = createHints({
      hints: SAMPLE_HINTS,
      onButtonClick: (element, hint) => productHints.dismiss(hint.id!),
    });
    productHints.show();

    beaconFor("intro").click();
    dismissButton()!.click();

    expect(beacons()).toHaveLength(1);
    expect(popoverEl()).toBeNull();
  });

  it("fires onDismiss for a programmatic dismiss", () => {
    const onDismiss = vi.fn();
    const productHints = createHints({ hints: SAMPLE_HINTS, onDismiss });
    productHints.show();

    productHints.dismiss("card");

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not fire onDismiss when the popover is only closed", () => {
    const onDismiss = vi.fn();
    const productHints = createHints({ hints: SAMPLE_HINTS, onDismiss });
    productHints.show();

    beaconFor("intro").click();
    productHints.close();

    expect(onDismiss).not.toHaveBeenCalled();
  });

  it("passes the hint data through to the hooks", () => {
    const onOpen = vi.fn();
    createHints({ hints: [{ element: "#intro", data: { tracking: "hint-1" } }], onOpen }).show();

    beacons()[0].click();

    expect(onOpen.mock.calls[0][1].data).toEqual({ tracking: "hint-1" });
  });

  it("lets onPopoverRender mutate the hint popover", () => {
    createHints({
      hints: [
        {
          element: "#intro",
          popover: {
            title: "One",
            onPopoverRender: popover => {
              const extra = document.createElement("button");
              extra.classList.add("hint-extra-btn");
              popover.footerButtons.appendChild(extra);
            },
          },
        },
      ],
    }).show();

    beacons()[0].click();

    expect(document.querySelector(".driver-popover .hint-extra-btn")).not.toBeNull();
  });
});

describe("teardown", () => {
  it("removes every beacon and the popover on hide()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    beaconFor("intro").click();

    productHints.hide();

    expect(beacons()).toHaveLength(0);
    expect(popoverEl()).toBeNull();
    expect(productHints.isVisible()).toBe(false);
  });

  it("can be shown again after hide()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.hide();
    productHints.show();

    expect(beacons()).toHaveLength(2);
  });

  it("tolerates hide() before show()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });

    expect(() => productHints.hide()).not.toThrow();
  });
});

describe("tour interplay", () => {
  it("closes an open hint when a tour starts", async () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    beaconFor("intro").click();
    expect(popoverEl()).not.toBeNull();

    activeDriver = driver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour step" } }] });
    activeDriver.drive();
    await nextFrame();

    expect(productHints.getActive()).toBeUndefined();
    expect(popoverTitle()).toBe("Tour step");
  });

  it("leaves the beacons mounted for CSS to hide during a tour", async () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    activeDriver = driver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour step" } }] });
    activeDriver.drive();
    await nextFrame();

    expect(beacons()).toHaveLength(2);
    expect(document.body.classList.contains("driver-active")).toBe(true);

    activeDriver.destroy();
    await nextFrame();

    expect(beacons()).toHaveLength(2);
    expect(document.body.classList.contains("driver-active")).toBe(false);
  });

  it("keeps hint state independent of the tour", async () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    activeDriver = driver({ animate: false, steps: [{ element: "#card-1", popover: { title: "Tour step" } }] });
    activeDriver.drive();
    activeDriver.destroy();
    await nextFrame();

    productHints.open("intro");

    expect(popoverTitle()).toBe("Intro hint");
  });
});

describe("multiple instances", () => {
  it("keeps two hint instances isolated", () => {
    const first = hints({ hints: [{ element: "#intro", id: "a", popover: { title: "First" } }] });
    const second = hints({ hints: [{ element: "#card-1", id: "b", popover: { title: "Second" } }] });

    first.show();
    second.show();
    first.open("a");

    expect(beacons()).toHaveLength(2);
    expect(popoverTitle()).toBe("First");
    expect(second.getActive()).toBeUndefined();

    first.hide();
    second.hide();
  });
});

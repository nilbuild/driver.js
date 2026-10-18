import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { driver, type Driver } from "../src/driver";
import { hints, type DriverHint, type Hints } from "../src/hints";
import { DEMO_HTML, nextFrame } from "./utils";

// jsdom has no IntersectionObserver; the beacon visibility tests install a
// controllable fake, the rest just need the constructor to exist.
type ObserverCallback = (entries: { isIntersecting: boolean }[]) => void;
let observerCallbacks: { callback: ObserverCallback; target: Element; disconnected: boolean }[] = [];

class FakeIntersectionObserver {
  callback: ObserverCallback;

  constructor(callback: ObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    observerCallbacks.push({ callback: this.callback, target, disconnected: false });
  }

  disconnect() {
    observerCallbacks
      .filter(entry => entry.callback === this.callback)
      .forEach(entry => {
        entry.disconnected = true;
      });
  }
}

function intersect(target: Element, isIntersecting: boolean) {
  observerCallbacks
    .filter(entry => entry.target === target && !entry.disconnected)
    .forEach(entry => entry.callback([{ isIntersecting }]));
}

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
  observerCallbacks = [];
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver);
});

afterEach(() => {
  active?.hide();
  active = undefined;
  activeDriver?.destroy();
  activeDriver = undefined;
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

describe("mounting beacons", () => {
  it("mounts nothing until show() is called", () => {
    createHints({ hints: SAMPLE_HINTS });

    expect(beacons()).toHaveLength(0);
  });

  it("mounts a beacon per hint on show()", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

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
});

describe("beacon positioning", () => {
  const rect = (over: Partial<DOMRect>): DOMRect =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

  // Element box: 200x20 at (400, 400).
  const ELEMENT_BOX = { top: 400, left: 400, right: 600, bottom: 420, width: 200, height: 20 };

  function positionFor(beacon?: DriverHint["beacon"]) {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect(ELEMENT_BOX);

    createHints({ hints: [{ element: "#intro", beacon }] }).show();

    const mounted = beacons()[0];
    return { top: mounted.style.top, left: mounted.style.left };
  }

  it("defaults to the element's top-right corner", () => {
    expect(positionFor()).toEqual({ top: "400px", left: "600px" });
  });

  it.each([
    [
      { side: "top", align: "start" },
      { top: "400px", left: "400px" },
    ],
    [
      { side: "top", align: "center" },
      { top: "400px", left: "500px" },
    ],
    [
      { side: "top", align: "end" },
      { top: "400px", left: "600px" },
    ],
    [
      { side: "bottom", align: "start" },
      { top: "420px", left: "400px" },
    ],
    [
      { side: "bottom", align: "center" },
      { top: "420px", left: "500px" },
    ],
    [
      { side: "left", align: "start" },
      { top: "400px", left: "400px" },
    ],
    [
      { side: "left", align: "center" },
      { top: "410px", left: "400px" },
    ],
    [
      { side: "left", align: "end" },
      { top: "420px", left: "400px" },
    ],
    [
      { side: "right", align: "center" },
      { top: "410px", left: "600px" },
    ],
  ] as const)("anchors the beacon for %o", (beacon, expected) => {
    expect(positionFor(beacon)).toEqual(expected);
  });

  it("nudges the beacon by offsetX and offsetY", () => {
    expect(positionFor({ side: "top", align: "end", offsetX: 12, offsetY: -8 })).toEqual({
      top: "392px",
      left: "612px",
    });
  });

  it("repositions the beacons on scroll", async () => {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect(ELEMENT_BOX);
    createHints({ hints: [{ element: "#intro" }] }).show();

    expect(beacons()[0].style.top).toBe("400px");

    el.getBoundingClientRect = () => rect({ ...ELEMENT_BOX, top: 100, bottom: 120 });
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(beacons()[0].style.top).toBe("100px");
  });

  it("repositions the beacons when a nested container scrolls", async () => {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect(ELEMENT_BOX);
    createHints({ hints: [{ element: "#intro" }] }).show();

    el.getBoundingClientRect = () => rect({ ...ELEMENT_BOX, top: 200, bottom: 220 });
    // A scroll inside a container never reaches the window while bubbling, so
    // this only repositions if the listener is registered in capture phase.
    document.querySelector(".feature-list")!.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(beacons()[0].style.top).toBe("200px");
  });

  it("repositions the beacons on resize", async () => {
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect(ELEMENT_BOX);
    createHints({ hints: [{ element: "#intro" }] }).show();

    el.getBoundingClientRect = () => rect({ ...ELEMENT_BOX, left: 50, right: 250 });
    window.dispatchEvent(new Event("resize"));
    await nextFrame();

    expect(beacons()[0].style.left).toBe("250px");
  });
});

describe("popover arrow alignment", () => {
  const rect = (over: Partial<DOMRect>): DOMRect =>
    ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;

  it("shifts the popover so the arrow points at the beacon's center", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();

    // The arrow tip sits 22px from the popover's corner (15px inset + half of
    // the 14px hint arrow). For a 24px beacon the popover must therefore start
    // 22 - 12 = 10px before the beacon's left edge.
    const beacon = beaconFor("intro");
    beacon.getBoundingClientRect = () => rect({ top: 400, left: 400, right: 424, bottom: 424, width: 24, height: 24 });

    productHints.open("intro");

    expect(popoverEl()?.style.left).toBe("390px");
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

  it("cuts the hint's element out of the dim", () => {
    const rect = (over: Partial<DOMRect>): DOMRect =>
      ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect({ x: 400, y: 300, width: 200, height: 40 });

    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    // Full-screen subpath plus a cutout subpath. The cutout starts at the
    // element's x minus the 10px padding, plus the 5px corner radius: 395.
    const d = overlayPath()?.getAttribute("d") ?? "";
    expect(d).toContain(`M${window.innerWidth},0L0,0L0,${window.innerHeight}`);
    expect(d).toContain("M395,290");
  });

  it("tracks the element when the page scrolls", async () => {
    const rect = (over: Partial<DOMRect>): DOMRect =>
      ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect({ x: 400, y: 300, width: 200, height: 40 });

    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    el.getBoundingClientRect = () => rect({ x: 400, y: 100, width: 200, height: 40 });
    window.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(overlayPath()?.getAttribute("d")).toContain("M395,90");
  });

  it("closes the hint when the dimmed page is clicked", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    // Clicks land on the dimmed path (the svg lets pointer events through).
    overlayPath()!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(popoverEl()).toBeNull();
    expect(overlayEl()).toBeNull();
  });

  it("removes the overlay when the open hint is dismissed", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    productHints.dismiss("intro");

    expect(overlayEl()).toBeNull();
  });

  it("removes the overlay on hide()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    productHints.hide();

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

  it("anchors the popover to the element instead of the beacon", () => {
    const rect = (over: Partial<DOMRect>): DOMRect =>
      ({ top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON() {}, ...over }) as DOMRect;
    const el = document.querySelector<HTMLElement>("#intro")!;
    el.getBoundingClientRect = () => rect({ top: 300, left: 400, right: 600, bottom: 340, width: 200, height: 40 });

    const productHints = createHints({ hints: SAMPLE_HINTS, overlay: true });
    productHints.show();
    productHints.open("intro");

    // Tour-step alignment: the popover's left lines up with the cutout's edge,
    // element left minus the 10px overlay padding.
    expect(popoverEl()?.style.left).toBe("390px");
  });
});

describe("beacon visibility", () => {
  it("hides the beacon when its element leaves the viewport", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    const element = document.querySelector("#intro")!;

    intersect(element, false);
    expect(beaconFor("intro").classList.contains("driver-hint-hidden")).toBe(true);

    intersect(element, true);
    expect(beaconFor("intro").classList.contains("driver-hint-hidden")).toBe(false);
  });

  it("closes an open hint when its element leaves the viewport", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.open("intro");
    expect(popoverEl()).not.toBeNull();

    intersect(document.querySelector("#intro")!, false);

    expect(popoverEl()).toBeNull();
    expect(productHints.getActive()).toBeUndefined();
  });
});

describe("opening and closing", () => {
  it("opens the popover when the beacon is clicked", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    beaconFor("intro").click();

    expect(popoverTitle()).toBe("Intro hint");
    expect(beaconFor("intro").getAttribute("aria-expanded")).toBe("true");
  });

  it("anchors the popover to the beacon rather than the element", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    // The arrow points back at the beacon, which the position code only knows
    // about because the beacon is the anchor.
    expect(popoverEl()?.className).toContain("driver-hint-popover");
    expect(document.querySelector(".driver-popover-arrow")).not.toBeNull();
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

  it("closes on an outside click", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    document.querySelector<HTMLElement>(".page-header")!.click();

    expect(popoverEl()).toBeNull();
  });

  it("stays open when the popover itself is clicked", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    document.querySelector<HTMLElement>(".driver-popover-description")!.click();

    expect(popoverEl()).not.toBeNull();
  });

  it("closes on Escape and returns focus to the beacon", () => {
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();

    const focus = vi.spyOn(beaconFor("intro"), "focus");
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));

    expect(popoverEl()).toBeNull();
    expect(focus).toHaveBeenCalled();
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
    expect(dismissButton()?.style.display).toBe("block");
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
    createHints({ hints: SAMPLE_HINTS }).show();
    beaconFor("intro").click();
    document.querySelector<HTMLElement>(".page-header")!.click();

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
    // The hint is neither dismissed nor closed; the hook owns the behavior.
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
    createHints({ hints: SAMPLE_HINTS, onDismiss }).show();

    beaconFor("intro").click();
    window.dispatchEvent(new KeyboardEvent("keyup", { key: "Escape" }));

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

  it("detaches every listener on hide()", () => {
    const addSpy = vi.spyOn(window, "addEventListener");
    const removeSpy = vi.spyOn(window, "removeEventListener");
    const docAddSpy = vi.spyOn(document, "addEventListener");
    const docRemoveSpy = vi.spyOn(document, "removeEventListener");

    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.hide();

    // Every listener the module attaches is detached again, with the same
    // function reference and capture flag. A capture mismatch is the classic
    // way a listener silently outlives its teardown.
    const normalize = (calls: [string, unknown, unknown?][]) =>
      calls.map(([type, listener, options]) => ({
        type,
        listener,
        capture: options === true || (typeof options === "object" && (options as AddEventListenerOptions)?.capture),
      }));

    const attached = normalize(addSpy.mock.calls.concat(docAddSpy.mock.calls) as [string, unknown, unknown?][]);
    const detached = normalize(removeSpy.mock.calls.concat(docRemoveSpy.mock.calls) as [string, unknown, unknown?][]);

    expect(attached).toHaveLength(4);
    attached.forEach(entry => {
      expect(detached).toContainEqual(entry);
    });
  });

  it("disconnects the intersection observers on hide()", () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.hide();

    expect(observerCallbacks.every(entry => entry.disconnected)).toBe(true);
  });

  it("stops repositioning after hide()", async () => {
    const productHints = createHints({ hints: SAMPLE_HINTS });
    productHints.show();
    productHints.hide();

    window.dispatchEvent(new Event("scroll"));
    await nextFrame();

    expect(beacons()).toHaveLength(0);
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
    // The body-class observer settles on a microtask.
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

    // The beacons stay in the DOM and come back on their own when the tour
    // ends, because `.driver-active .driver-hint` hides them meanwhile.
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

describe("modal dialogs", () => {
  const DIALOG_HTML = `<dialog open><button id="in-dialog">Save</button></dialog>`;
  const DIALOG_HINT: DriverHint = { element: "#in-dialog", id: "d", popover: { title: "In dialog" } };

  // A modal dialog renders in the top layer, above anything left in <body>.
  describe("with the popover API", () => {
    let showPopover: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      showPopover = vi.fn();
      Object.assign(HTMLElement.prototype, { showPopover, hidePopover: vi.fn() });
    });

    afterEach(() => {
      delete (HTMLElement.prototype as Partial<HTMLElement>).showPopover;
      delete (HTMLElement.prototype as Partial<HTMLElement>).hidePopover;
    });

    it("mounts the beacon, overlay and popover in a top-layer host inside the dialog", () => {
      document.body.insertAdjacentHTML("beforeend", DIALOG_HTML);
      const dialog = document.querySelector("dialog")!;

      const h = createHints({ overlay: true, hints: [DIALOG_HINT] });
      h.show();
      h.open("d");

      const layer = dialog.querySelector(":scope > .driver-layer")!;
      expect(layer.getAttribute("popover")).toBe("manual");
      expect(showPopover).toHaveBeenCalled();
      expect(beacons()[0].parentElement).toBe(layer);
      expect(document.querySelector(".driver-hint-overlay")!.parentElement).toBe(layer);
      expect(popoverEl()!.parentElement).toBe(layer);
      expect(dialog.querySelectorAll(".driver-layer")).toHaveLength(1);
    });

    it("removes the host once its UI is gone", () => {
      document.body.insertAdjacentHTML("beforeend", DIALOG_HTML);
      const dialog = document.querySelector("dialog")!;

      const h = createHints({ hints: [DIALOG_HINT] });
      h.show();
      h.open("d");
      h.hide();

      expect(dialog.querySelector(".driver-layer")).toBeNull();
    });
  });

  it("mounts inside the dialog itself without the popover API", () => {
    document.body.insertAdjacentHTML("beforeend", DIALOG_HTML);
    const dialog = document.querySelector("dialog")!;

    const h = createHints({ overlay: true, hints: [DIALOG_HINT] });
    h.show();
    h.open("d");

    expect(beacons()[0].parentElement).toBe(dialog);
    expect(document.querySelector(".driver-hint-overlay")!.parentElement).toBe(dialog);
    expect(popoverEl()!.parentElement).toBe(dialog);
  });

  it("keeps mounting in <body> outside a dialog", () => {
    createHints({ hints: SAMPLE_HINTS }).show();

    expect(beacons()[0].parentElement).toBe(document.body);
  });
});

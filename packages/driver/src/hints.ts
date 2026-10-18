import {
  Alignment,
  destroyPopover,
  PopoverDOM,
  PopoverRenderOptions,
  renderPopover,
  Side,
  hidePopover,
} from "./popover";
import { generateStageSvgPathString } from "./stage";
import { ARROW_CORNER_INSET, PositionOptions, repositionPopover } from "./position";
import { layerFor, removeFromLayer, resolveElement } from "./utils";
import "./hints.css";

// The cutout around the active hint's element, mirroring the tour's defaults.
const OVERLAY_PADDING = 10;
const OVERLAY_RADIUS = 5;

// Must match the arrow's border-width in hints.css; the popover shift that
// puts the arrow tip on the beacon runs before the popover exists, so the
// size cannot be measured.
const HINT_ARROW_SIZE = 14;

export type { Alignment, PopoverDOM, Side } from "./popover";

export type HintBeacon = {
  // Which edge of the element the beacon sits on, and where along that edge.
  // Together they give the twelve anchor points of the element's box.
  side?: Side;
  align?: Alignment;
  animate?: boolean;
  className?: string;

  // Nudge the beacon in pixels from its computed anchor point. Positive
  // offsetX moves it right, negative left; positive offsetY moves it down,
  // negative up. Handy for fine-tuning placement on large or irregular targets.
  offsetX?: number;
  offsetY?: number;
};

export type HintPopover = {
  title?: string;
  description?: string;
  side?: Side;
  align?: Alignment;
  popoverClass?: string;

  // The dismiss button. Hidden with `showButton: false`, leaving a popover
  // that is only dismissed programmatically.
  showButton?: boolean;
  buttonText?: string;

  // Runs instead of dismissing when the button is clicked, like a tour's
  // onNextClick takes over the default advance. Call dismiss() yourself to
  // also remove the hint.
  onButtonClick?: HintHook;

  onPopoverRender?: (popover: PopoverDOM, opts: { hint: DriverHint; hints: Hints }) => void;
};

export type HintHook = (element: Element, hint: DriverHint, opts: { config: HintsConfig; hints: Hints }) => void;

export type DriverHint = {
  element: string | Element | (() => Element);

  // Stable identity for open/dismiss/restore and for persisting dismissals.
  // Defaults to the hint's index in the array.
  id?: string;

  beacon?: HintBeacon;
  popover?: HintPopover;

  onOpen?: HintHook;
  onDismiss?: HintHook;

  data?: Record<string, any>;
};

export type HintsConfig = {
  hints?: DriverHint[];

  // Defaults for every hint; a hint's own values win.
  beacon?: HintBeacon;
  buttonText?: string;
  popoverClass?: string;
  popoverOffset?: number;

  // Dim the page while a hint is open, with the hint's element cut out like a
  // tour step. The popover then anchors to the element, the open hint's beacon
  // steps aside, and the other beacons wait under the dim; clicking the dimmed
  // page closes the hint.
  overlay?: boolean;
  overlayColor?: string;
  overlayOpacity?: number;

  onOpen?: HintHook;
  onDismiss?: HintHook;
  onButtonClick?: HintHook;
};

export interface Hints {
  show: () => void;
  hide: () => void;
  open: (id: string | number) => void;
  close: () => void;
  dismiss: (id: string | number) => void;
  restore: (id: string | number) => void;
  restoreAll: () => void;
  setHints: (hints: DriverHint[]) => void;
  getHints: () => DriverHint[];
  getActive: () => DriverHint | undefined;
  isVisible: () => boolean;
  refresh: () => void;
}

type MountedHint = {
  hint: DriverHint;
  id: string;
  element: Element;
  beacon: HTMLButtonElement;
  observer?: IntersectionObserver;
};

export function hints(config: HintsConfig = {}): Hints {
  const currentConfig: HintsConfig = { ...config };
  const dismissed = new Set<string>();
  let mounted: MountedHint[] = [];
  let teardown: (() => void)[] = [];

  let activeId: string | undefined;
  let popover: PopoverDOM | undefined;
  let overlay: SVGSVGElement | undefined;
  let refreshTimeout: number | undefined;
  let isVisible = false;

  function hintId(hint: DriverHint, index: number): string {
    return hint.id ?? `${index}`;
  }

  function find(id: string | number): MountedHint | undefined {
    return mounted.find(entry => entry.id === `${id}`);
  }

  function beaconConfig(hint: DriverHint): HintBeacon {
    return { ...currentConfig.beacon, ...hint.beacon };
  }

  function createBeacon(hint: DriverHint, id: string): HTMLButtonElement {
    const beacon = document.createElement("button");
    const { animate, className } = beaconConfig(hint);

    beacon.type = "button";
    beacon.className = `driver-hint ${className || ""}`.trim();
    if (animate === false) {
      beacon.classList.add("driver-hint-no-animation");
    }

    beacon.setAttribute("aria-label", hint.popover?.title || "Show hint");
    beacon.setAttribute("aria-haspopup", "dialog");
    beacon.setAttribute("aria-expanded", "false");

    const pulse = document.createElement("span");
    pulse.className = "driver-hint-pulse";

    const dot = document.createElement("span");
    dot.className = "driver-hint-dot";

    beacon.appendChild(pulse);
    beacon.appendChild(dot);

    beacon.addEventListener("click", event => {
      event.preventDefault();
      event.stopPropagation();
      toggle(id);
    });

    return beacon;
  }

  // The beacon is centered on its anchor point by CSS, so this only has to
  // find the point itself.
  function positionBeacon(entry: MountedHint) {
    const { side = "top", align = "end", offsetX = 0, offsetY = 0 } = beaconConfig(entry.hint);
    const rect = entry.element.getBoundingClientRect();

    let top: number;
    let left: number;

    if (side === "top" || side === "bottom") {
      top = side === "top" ? rect.top : rect.bottom;
      left = align === "start" ? rect.left : align === "center" ? rect.left + rect.width / 2 : rect.right;
    } else {
      left = side === "left" ? rect.left : rect.right;
      top = align === "start" ? rect.top : align === "center" ? rect.top + rect.height / 2 : rect.bottom;
    }

    entry.beacon.style.top = `${top + offsetY}px`;
    entry.beacon.style.left = `${left + offsetX}px`;
  }

  // Hide the beacon when its element scrolls out of view (or out of a
  // scrollable container), so it never floats over unrelated UI.
  function observeVisibility(entry: MountedHint) {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    entry.observer = new IntersectionObserver(([intersection]) => {
      entry.beacon.classList.toggle("driver-hint-hidden", !intersection.isIntersecting);

      if (intersection.isIntersecting) {
        layerFor(entry.element);
      }

      if (!intersection.isIntersecting && activeId === entry.id) {
        close();
      }
    });

    entry.observer.observe(entry.element);
  }

  function mountHint(hint: DriverHint, id: string) {
    // A hint without an anchor has nothing to point at. It is skipped rather
    // than centered like a tour's element-less popover, and picked up on the
    // next show() if the element appears later.
    const element = resolveElement(hint.element);
    if (!element) {
      return;
    }

    const beacon = createBeacon(hint, id);
    layerFor(element).appendChild(beacon);

    const entry: MountedHint = { hint, id, element, beacon };
    mounted.push(entry);

    positionBeacon(entry);
    observeVisibility(entry);
  }

  function mountHints() {
    (currentConfig.hints || []).forEach((hint, index) => {
      const id = hintId(hint, index);
      if (dismissed.has(id) || find(id)) {
        return;
      }

      mountHint(hint, id);
    });
  }

  function unmountHints() {
    mounted.forEach(entry => {
      entry.observer?.disconnect();
      removeFromLayer(entry.beacon);
    });

    mounted = [];
  }

  function requireRefresh() {
    if (refreshTimeout) {
      window.cancelAnimationFrame(refreshTimeout);
    }

    refreshTimeout = window.requestAnimationFrame(() => refresh());
  }

  function bindListeners() {
    const onDocumentClick = (event: MouseEvent) => {
      if (!activeId) {
        return;
      }

      const target = event.target as Node;
      // Clicks on the popover keep it open; clicks on a beacon are already
      // handled by the beacon itself (which toggles or swaps the popover).
      if (popover?.wrapper.contains(target) || mounted.some(entry => entry.beacon.contains(target))) {
        return;
      }

      close();
    };

    const onKeyup = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeId) {
        return;
      }

      // Escape came from the keyboard, so send focus back where it started.
      const beacon = find(activeId)?.beacon;
      close();
      beacon?.focus();
    };

    // Capture, so scrolling inside a nested container repositions the beacons
    // too; those events never reach the window during the bubble phase.
    window.addEventListener("scroll", requireRefresh, true);
    window.addEventListener("resize", requireRefresh);
    document.addEventListener("click", onDocumentClick);
    window.addEventListener("keyup", onKeyup);

    teardown = [
      () => window.removeEventListener("scroll", requireRefresh, true),
      () => window.removeEventListener("resize", requireRefresh),
      () => document.removeEventListener("click", onDocumentClick),
      () => window.removeEventListener("keyup", onKeyup),
    ];

    // A tour takes over the screen, so an open hint steps aside. The tour
    // marks the body while it runs, which lets this work with any driver
    // instance without the two knowing about each other. The beacons
    // themselves are hidden by CSS off the same marker.
    if (typeof MutationObserver === "undefined") {
      return;
    }

    const tourObserver = new MutationObserver(() => {
      if (!document.body.classList.contains("driver-active")) {
        return;
      }

      close();
    });

    tourObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    teardown.push(() => tourObserver.disconnect());
  }

  // With the overlay, the popover anchors to the element like a tour step;
  // without it, to the beacon.
  function popoverAnchor(entry: MountedHint): Element {
    return currentConfig.overlay ? entry.element : entry.beacon;
  }

  function popoverPosition(entry: MountedHint): PositionOptions {
    const side = entry.hint.popover?.side || "bottom";
    const align = entry.hint.popover?.align || "start";
    const offset = currentConfig.popoverOffset ?? 10;

    // Overlay mode reads like a tour step: the popover clears the cutout ring
    // and lines up with its edge.
    if (currentConfig.overlay) {
      return { side, align, offset: OVERLAY_PADDING + offset, padding: OVERLAY_PADDING };
    }

    // The arrow sits a fixed inset from the popover's corner. Shift the
    // popover by the difference between the arrow tip and the beacon's
    // half-size (via `padding`, the alignment pull-back), so for start/end
    // alignments the arrow points at the beacon's center instead of beside it.
    const beaconSize = entry.beacon.getBoundingClientRect().width;
    const arrowTip = ARROW_CORNER_INSET + HINT_ARROW_SIZE / 2;

    return {
      side,
      align,
      // The popover hangs off the beacon, and there is no stage to clear.
      offset,
      padding: arrowTip - beaconSize / 2,
    };
  }

  function overlayPathFor(element: Element): string {
    const rect = element.getBoundingClientRect();

    return generateStageSvgPathString(
      { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      { padding: OVERLAY_PADDING, radius: OVERLAY_RADIUS }
    );
  }

  function showOverlay(entry: MountedHint) {
    if (!currentConfig.overlay || overlay) {
      return;
    }

    // A full-screen dim with the hint's element cut out, so what the hint
    // talks about stays visible. Pointer events land on the path only: clicks
    // on the dim close the hint (via the outside-click listener) while the
    // element inside the cutout stays interactive.
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("class", "driver-hint-overlay");
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    svg.setAttribute("preserveAspectRatio", "xMinYMin slice");
    svg.style.fillRule = "evenodd";

    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", overlayPathFor(entry.element));
    path.style.fill = currentConfig.overlayColor || "#000";
    path.style.opacity = `${currentConfig.overlayOpacity ?? 0.7}`;
    path.style.pointerEvents = "auto";

    svg.appendChild(path);
    layerFor(entry.element).appendChild(svg);

    overlay = svg;
  }

  function refreshOverlay(entry: MountedHint) {
    if (!overlay) {
      return;
    }

    overlay.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    overlay.firstElementChild?.setAttribute("d", overlayPathFor(entry.element));
  }

  function removeOverlay() {
    if (overlay) {
      removeFromLayer(overlay);
    }
    overlay = undefined;
  }

  function popoverOptions(entry: MountedHint): PopoverRenderOptions {
    const hintPopover = entry.hint.popover || {};
    const showButton = hintPopover.showButton ?? true;

    return {
      title: hintPopover.title,
      description: hintPopover.description,

      // A hint is a single self-contained callout: one dismiss button, no
      // navigation, no progress, and no separate close button.
      showButtons: showButton ? ["next"] : [],
      disableButtons: [],
      showProgress: false,
      progressText: "",
      nextBtnText: hintPopover.buttonText ?? currentConfig.buttonText ?? "Got it",
      prevBtnText: "",
      closeBtnLabel: "Close",

      popoverClass: `driver-hint-popover ${hintPopover.popoverClass || currentConfig.popoverClass || ""}`.trim(),

      // Resolved at click time so a hook set after render is still picked up.
      onNextClick: () => {
        const onButtonClick = hintPopover.onButtonClick || currentConfig.onButtonClick;
        if (onButtonClick) {
          return onButtonClick(entry.element, entry.hint, { config: currentConfig, hints: api });
        }

        dismiss(entry.id);
      },
      onRender: popoverDom => hintPopover.onPopoverRender?.(popoverDom, { hint: entry.hint, hints: api }),

      position: popoverPosition(entry),
    };
  }

  function close() {
    if (!popover) {
      return;
    }

    const entry = find(activeId!);
    if (entry) {
      entry.beacon.setAttribute("aria-expanded", "false");
      // Bring back a beacon that overlay mode tucked away.
      entry.beacon.style.display = "";
    }

    destroyPopover(popover);
    popover = undefined;
    activeId = undefined;

    removeOverlay();
  }

  function open(id: string | number) {
    const entry = find(id);
    if (!entry) {
      return;
    }

    // Only one hint is open at a time; opening another swaps it out.
    close();

    activeId = entry.id;
    entry.beacon.setAttribute("aria-expanded", "true");
    showOverlay(entry);

    // In overlay mode the spotlight does the pointing, so the beacon steps
    // aside while its popover is up and the popover frames the element.
    if (currentConfig.overlay) {
      entry.beacon.style.display = "none";
    }

    popover = renderPopover(popoverAnchor(entry), popoverOptions(entry));

    const onOpen = entry.hint.onOpen || currentConfig.onOpen;
    onOpen?.(entry.element, entry.hint, { config: currentConfig, hints: api });
  }

  function toggle(id: string | number) {
    if (activeId === `${id}`) {
      close();
      return;
    }

    open(id);
  }

  function dismiss(id: string | number) {
    const entry = find(id);
    if (!entry) {
      return;
    }

    if (activeId === entry.id) {
      close();
    }

    dismissed.add(entry.id);

    entry.observer?.disconnect();
    removeFromLayer(entry.beacon);
    mounted = mounted.filter(mountedEntry => mountedEntry !== entry);

    const onDismiss = entry.hint.onDismiss || currentConfig.onDismiss;
    onDismiss?.(entry.element, entry.hint, { config: currentConfig, hints: api });
  }

  function restore(id: string | number) {
    const key = `${id}`;
    if (!dismissed.delete(key) || !isVisible || find(key)) {
      return;
    }

    const list = currentConfig.hints || [];
    const index = list.findIndex((hint, hintIndex) => hintId(hint, hintIndex) === key);
    if (index === -1) {
      return;
    }

    mountHint(list[index], key);
  }

  // Bring back every dismissed hint at once; the bulk counterpart to restore().
  function restoreAll() {
    dismissed.clear();
    if (isVisible) {
      mountHints();
    }
  }

  function refresh() {
    mounted.forEach(positionBeacon);

    const active = activeId ? find(activeId) : undefined;
    if (!active || !popover) {
      return;
    }

    repositionPopover(popover, popoverAnchor(active), popoverPosition(active));
    refreshOverlay(active);

    // The beacon is gone from the screen, so the popover has nothing to hang
    // off; the IntersectionObserver closes it, this just avoids a flash.
    if (active.beacon.classList.contains("driver-hint-hidden")) {
      hidePopover(popover);
    }
  }

  function show() {
    if (!isVisible) {
      isVisible = true;
      bindListeners();
    }

    // mountHints() skips what is already on the page, so calling show() again
    // picks up hints whose elements have appeared since.
    mountHints();
    refresh();
  }

  function hide() {
    if (!isVisible) {
      return;
    }

    isVisible = false;
    close();
    unmountHints();

    teardown.forEach(off => off());
    teardown = [];

    if (!refreshTimeout) {
      return;
    }

    window.cancelAnimationFrame(refreshTimeout);
    refreshTimeout = undefined;
  }

  function setHints(list: DriverHint[]) {
    currentConfig.hints = list;
    dismissed.clear();

    if (!isVisible) {
      return;
    }

    close();
    unmountHints();
    mountHints();
  }

  const api: Hints = {
    show,
    hide,
    open,
    close,
    dismiss,
    restore,
    restoreAll,
    setHints,
    getHints: () => currentConfig.hints || [],
    getActive: () => (activeId ? find(activeId)?.hint : undefined),
    isVisible: () => isVisible,
    refresh,
  };

  return api;
}

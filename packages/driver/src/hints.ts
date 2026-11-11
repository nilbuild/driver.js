import {
  Alignment,
  destroyPopover,
  PopoverDOM,
  PopoverRenderOptions,
  renderPopover,
  Side,
  hidePopover,
} from "./popover/popover";
import { createStageSvg, generateStageSvgPathString, stageViewBox } from "./overlay/stage";
import { ARROW_CORNER_INSET, PositionOptions, repositionPopover } from "./popover/position";
import { layerFor, removeFromLayer, resolveElement } from "./core/utils";
import "./styles/hints.css";

const OVERLAY_PADDING = 10;
const OVERLAY_RADIUS = 5;

const HINT_ARROW_SIZE = 14;

export type { Alignment, PopoverDOM, Side } from "./popover/popover";

export type HintBeacon = {
  side?: Side;
  align?: Alignment;
  animate?: boolean;
  className?: string;

  offsetX?: number;
  offsetY?: number;
};

export type HintPopover = {
  title?: string;
  description?: string;
  side?: Side;
  align?: Alignment;
  popoverClass?: string;

  showButton?: boolean;
  buttonText?: string;

  onButtonClick?: HintHook;

  onPopoverRender?: (popover: PopoverDOM, opts: { hint: DriverHint; hints: Hints }) => void;
};

export type HintHook = (element: Element, hint: DriverHint, opts: { config: HintsConfig; hints: Hints }) => void;

export type DriverHint = {
  element: string | Element | (() => Element);

  id?: string;

  beacon?: HintBeacon;
  popover?: HintPopover;

  onOpen?: HintHook;
  onDismiss?: HintHook;

  data?: Record<string, any>;
};

export type HintsConfig = {
  hints?: DriverHint[];

  beacon?: HintBeacon;
  buttonText?: string;
  popoverClass?: string;
  popoverOffset?: number;

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
  let visibility: IntersectionObserver | undefined;
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

  function isTourActive() {
    return document.body.classList.contains("driver-active");
  }

  function isBeaconShown(entry: MountedHint) {
    return !entry.beacon.classList.contains("driver-hint-hidden");
  }

  function positionBeacons(entries: MountedHint[]) {
    if (isTourActive()) {
      return;
    }

    entries
      .map(entry => ({ entry, rect: entry.element.getBoundingClientRect() }))
      .forEach(({ entry, rect }) => placeBeacon(entry, rect));
  }

  function placeBeacon(entry: MountedHint, rect: DOMRect) {
    const { side = "top", align = "end", offsetX = 0, offsetY = 0 } = beaconConfig(entry.hint);

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

  function onVisibilityChange(intersections: IntersectionObserverEntry[]) {
    const shown: MountedHint[] = [];

    intersections.forEach(intersection => {
      mounted
        .filter(entry => entry.element === intersection.target)
        .forEach(entry => {
          entry.beacon.classList.toggle("driver-hint-hidden", !intersection.isIntersecting);

          if (intersection.isIntersecting) {
            layerFor(entry.element);
            shown.push(entry);
          }

          if (!intersection.isIntersecting && activeId === entry.id) {
            close();
          }
        });
    });

    positionBeacons(shown);
  }

  function observeVisibility(entry: MountedHint) {
    if (typeof IntersectionObserver === "undefined") {
      return;
    }

    visibility ??= new IntersectionObserver(onVisibilityChange);
    visibility.observe(entry.element);
  }

  function unobserveVisibility(entry: MountedHint) {
    if (mounted.some(other => other !== entry && other.element === entry.element)) {
      return;
    }

    visibility?.unobserve(entry.element);
  }

  function mountHint(hint: DriverHint, id: string): MountedHint | undefined {
    const element = resolveElement(hint.element);
    if (!element) {
      return undefined;
    }

    const beacon = createBeacon(hint, id);
    layerFor(element).appendChild(beacon);

    const entry: MountedHint = { hint, id, element, beacon };
    mounted.push(entry);

    observeVisibility(entry);

    return entry;
  }

  function mountHints() {
    const entries = (currentConfig.hints || []).flatMap((hint, index) => {
      const id = hintId(hint, index);
      if (dismissed.has(id) || find(id)) {
        return [];
      }

      return mountHint(hint, id) ?? [];
    });

    positionBeacons(entries);
  }

  function unmountHints() {
    visibility?.disconnect();
    visibility = undefined;
    mounted.forEach(entry => removeFromLayer(entry.beacon));

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
      if (popover?.wrapper.contains(target) || mounted.some(entry => entry.beacon.contains(target))) {
        return;
      }

      close();
    };

    const onKeyup = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || !activeId) {
        return;
      }

      const beacon = find(activeId)?.beacon;
      close();
      beacon?.focus();
    };

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

    if (typeof MutationObserver === "undefined") {
      return;
    }

    let wasTourActive = isTourActive();
    const tourObserver = new MutationObserver(() => {
      const isActive = isTourActive();
      const hasTourEnded = wasTourActive && !isActive;
      wasTourActive = isActive;

      if (hasTourEnded) {
        requireRefresh();
      }

      if (isActive) {
        close();
      }
    });

    tourObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });
    teardown.push(() => tourObserver.disconnect());
  }

  function popoverAnchor(entry: MountedHint): Element {
    return currentConfig.overlay ? entry.element : entry.beacon;
  }

  function popoverPosition(entry: MountedHint): PositionOptions {
    const side = entry.hint.popover?.side || "bottom";
    const align = entry.hint.popover?.align || "start";
    const offset = currentConfig.popoverOffset ?? 10;

    if (currentConfig.overlay) {
      return { side, align, offset: OVERLAY_PADDING + offset, padding: OVERLAY_PADDING };
    }

    const beaconSize = entry.beacon.getBoundingClientRect().width;
    const arrowTip = ARROW_CORNER_INSET + HINT_ARROW_SIZE / 2;

    return {
      side,
      align,
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

    const svg = createStageSvg(
      "driver-hint-overlay",
      overlayPathFor(entry.element),
      currentConfig.overlayColor || "#000",
      currentConfig.overlayOpacity ?? 0.7
    );

    layerFor(entry.element).appendChild(svg);

    overlay = svg;
  }

  function refreshOverlay(entry: MountedHint) {
    if (!overlay) {
      return;
    }

    overlay.setAttribute("viewBox", stageViewBox());
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

      showButtons: showButton ? ["next"] : [],
      disableButtons: [],
      showProgress: false,
      progressText: "",
      nextBtnText: hintPopover.buttonText ?? currentConfig.buttonText ?? "Got it",
      prevBtnText: "",
      closeBtnLabel: "Close",

      popoverClass: `driver-hint-popover ${hintPopover.popoverClass || currentConfig.popoverClass || ""}`.trim(),

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

    close();

    activeId = entry.id;
    entry.beacon.setAttribute("aria-expanded", "true");
    showOverlay(entry);

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

    unobserveVisibility(entry);
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

    const entry = mountHint(list[index], key);
    if (entry) {
      positionBeacons([entry]);
    }
  }

  function restoreAll() {
    dismissed.clear();
    if (isVisible) {
      mountHints();
    }
  }

  function refresh() {
    positionBeacons(mounted.filter(isBeaconShown));

    const active = activeId ? find(activeId) : undefined;
    if (!active || !popover) {
      return;
    }

    repositionPopover(popover, popoverAnchor(active), popoverPosition(active));
    refreshOverlay(active);

    if (active.beacon.classList.contains("driver-hint-hidden")) {
      hidePopover(popover);
    }
  }

  function show() {
    if (!isVisible) {
      isVisible = true;
      bindListeners();
    }

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

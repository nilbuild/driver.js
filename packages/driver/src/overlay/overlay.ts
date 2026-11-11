import {
  easeInOutQuad,
  isDummyElement,
  isInsideAllowedElement,
  layerFor,
  moveToLayerOf,
  placeInLayer,
  removeFromLayer,
} from "../core/utils";
import { destroyDriverClick, onDriverClick } from "../core/click";
import { Context } from "../core/context";
import {
  createStageSvg,
  generateExtraCutoutsPathString,
  generateStageSvgPathString,
  StageCutout,
  stageCutout,
  StageDefinition,
  stageViewBox,
} from "./stage";

export function transitionStage(ctx: Context, elapsed: number, duration: number, from: Element, to: Element) {
  let activeStagePosition = ctx.getState("__activeStagePosition");

  const fromDefinition = activeStagePosition ? activeStagePosition : from.getBoundingClientRect();
  const toDefinition = to.getBoundingClientRect();

  const x = easeInOutQuad(elapsed, fromDefinition.x, toDefinition.x - fromDefinition.x, duration);
  const y = easeInOutQuad(elapsed, fromDefinition.y, toDefinition.y - fromDefinition.y, duration);
  const width = easeInOutQuad(elapsed, fromDefinition.width, toDefinition.width - fromDefinition.width, duration);
  const height = easeInOutQuad(elapsed, fromDefinition.height, toDefinition.height - fromDefinition.height, duration);

  activeStagePosition = {
    x,
    y,
    width,
    height,
  };

  renderOverlay(ctx, activeStagePosition, to);
  ctx.setState("__activeStagePosition", activeStagePosition);
}

export function trackActiveElement(ctx: Context, element: Element) {
  if (!element) {
    return;
  }

  const definition = element.getBoundingClientRect();

  const activeStagePosition: StageDefinition = {
    x: definition.x,
    y: definition.y,
    width: definition.width,
    height: definition.height,
  };

  ctx.setState("__activeStagePosition", activeStagePosition);

  renderOverlay(ctx, activeStagePosition, element);
}

export function refreshOverlay(ctx: Context) {
  const activeStagePosition = ctx.getState("__activeStagePosition");
  const overlaySvg = ctx.getState("__overlaySvg");

  if (!activeStagePosition || !overlaySvg) {
    return;
  }

  overlaySvg.setAttribute("viewBox", stageViewBox());
}

function mountOverlay(ctx: Context, stagePosition: StageDefinition, element: Element) {
  const overlaySvg = createOverlaySvg(ctx, stagePosition);
  placeInLayer(overlaySvg, layerFor(element), true);

  onDriverClick(overlaySvg, e => {
    const target = e.target as SVGElement;
    if (target.tagName !== "path") {
      return;
    }

    ctx.tour.overlayClick();
  });

  ctx.setState("__overlaySvg", overlaySvg);

  return overlaySvg;
}

function preventFadeInReplay(overlaySvg: SVGSVGElement) {
  overlaySvg.style.animation = "none";
}

function placeOverlay(overlaySvg: SVGSVGElement, element: Element) {
  const hasMovedLayer = moveToLayerOf(overlaySvg, element, true);
  if (hasMovedLayer) {
    preventFadeInReplay(overlaySvg);
  }
}

function allowedCutouts(overlaySvg: SVGSVGElement, cutout: StageCutout): string {
  const dialog = overlaySvg.closest("dialog");
  if (!dialog) {
    return "";
  }

  const allowedRects = Array.from(dialog.querySelectorAll(".driver-allowed-element")).map(allowed =>
    allowed.getBoundingClientRect()
  );

  return generateExtraCutoutsPathString(cutout, allowedRects);
}

function renderOverlay(ctx: Context, stagePosition: StageDefinition, element: Element) {
  const overlaySvg = ctx.getState("__overlaySvg") ?? mountOverlay(ctx, stagePosition, element);
  placeOverlay(overlaySvg, element);

  const pathElement = overlaySvg.firstElementChild as SVGPathElement | null;
  if (pathElement?.tagName !== "path") {
    return;
  }

  const options = stageOptions(ctx);
  pathElement.setAttribute(
    "d",
    generateStageSvgPathString(stagePosition, options) + allowedCutouts(overlaySvg, stageCutout(stagePosition, options))
  );
}

export function redrawOverlay(ctx: Context, isOutsideDialogToo = false) {
  const stagePosition = ctx.getState("__activeStagePosition");
  const element = ctx.getState("activeElement");
  const overlaySvg = ctx.getState("__overlaySvg");
  if (stagePosition && element && overlaySvg && (isOutsideDialogToo || overlaySvg.closest("dialog"))) {
    renderOverlay(ctx, stagePosition, element);
  }
}

function stageOptions(ctx: Context) {
  const element = ctx.getState("activeElement");
  if (element && (isDummyElement(element) || isInsideAllowedElement(element))) {
    return { padding: 0, radius: 0 };
  }

  return {
    padding: ctx.getConfig("stagePadding") || 0,
    radius: ctx.getConfig("stageRadius") || 0,
  };
}

function createOverlaySvg(ctx: Context, stage: StageDefinition): SVGSVGElement {
  const svg = createStageSvg(
    "driver-overlay driver-overlay-animated",
    generateStageSvgPathString(stage, stageOptions(ctx)),
    ctx.getConfig("overlayColor") || "rgb(0,0,0)",
    `${ctx.getConfig("overlayOpacity")}`
  );

  svg.setAttribute("version", "1.1");
  svg.style.cssText +=
    "clip-rule:evenodd;stroke-linejoin:round;stroke-miterlimit:2;z-index:10000;position:fixed;top:0;left:0;width:100%;height:100%";
  (svg.firstElementChild as SVGPathElement).style.cursor = "auto";

  return svg;
}

export function destroyOverlay(ctx: Context) {
  const overlaySvg = ctx.getState("__overlaySvg");
  if (overlaySvg) {
    destroyDriverClick(overlaySvg);
    removeFromLayer(overlaySvg);
  }
}

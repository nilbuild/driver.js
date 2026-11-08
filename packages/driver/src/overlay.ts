import { easeInOutQuad } from "./utils";
import { destroyDriverClick, onDriverClick } from "./click";
import { Context } from "./context";
import { generateStageSvgPathString, StageDefinition } from "./stage";

// This method calculates the animated new position of the
// stage (called for each frame by requestAnimationFrame)
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

  renderOverlay(ctx, activeStagePosition);
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

  renderOverlay(ctx, activeStagePosition);
}

export function refreshOverlay(ctx: Context) {
  const activeStagePosition = ctx.getState("__activeStagePosition");
  const overlaySvg = ctx.getState("__overlaySvg");

  if (!activeStagePosition) {
    return;
  }

  if (!overlaySvg) {
    console.warn("No stage svg found.");
    return;
  }

  const windowX = window.innerWidth;
  const windowY = window.innerHeight;

  overlaySvg.setAttribute("viewBox", `0 0 ${windowX} ${windowY}`);
}

function mountOverlay(ctx: Context, stagePosition: StageDefinition) {
  const overlaySvg = createOverlaySvg(ctx, stagePosition);
  document.body.appendChild(overlaySvg);

  onDriverClick(overlaySvg, e => {
    const target = e.target as SVGElement;
    if (target.tagName !== "path") {
      return;
    }

    ctx.emit("overlayClick");
  });

  ctx.setState("__overlaySvg", overlaySvg);
}

function renderOverlay(ctx: Context, stagePosition: StageDefinition) {
  const overlaySvg = ctx.getState("__overlaySvg");

  // TODO: cancel rendering if element is not visible
  if (!overlaySvg) {
    mountOverlay(ctx, stagePosition);

    return;
  }

  const pathElement = overlaySvg.firstElementChild as SVGPathElement | null;
  if (pathElement?.tagName !== "path") {
    throw new Error("no path element found in stage svg");
  }

  pathElement.setAttribute("d", generateStageSvgPathString(stagePosition, stageOptions(ctx)));
}

function stageOptions(ctx: Context) {
  if (ctx.getState("activeElement")?.id === "driver-dummy-element") {
    return { padding: 0, radius: 0 };
  }

  return {
    padding: ctx.getConfig("stagePadding") || 0,
    radius: ctx.getConfig("stageRadius") || 0,
  };
}

function createOverlaySvg(ctx: Context, stage: StageDefinition): SVGSVGElement {
  const windowX = window.innerWidth;
  const windowY = window.innerHeight;

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("driver-overlay", "driver-overlay-animated");

  svg.setAttribute("viewBox", `0 0 ${windowX} ${windowY}`);
  svg.setAttribute("xmlSpace", "preserve");
  svg.setAttribute("xmlnsXlink", "http://www.w3.org/1999/xlink");
  svg.setAttribute("version", "1.1");
  svg.setAttribute("preserveAspectRatio", "xMinYMin slice");

  svg.style.fillRule = "evenodd";
  svg.style.clipRule = "evenodd";
  svg.style.strokeLinejoin = "round";
  svg.style.strokeMiterlimit = "2";
  svg.style.zIndex = "10000";
  svg.style.position = "fixed";
  svg.style.top = "0";
  svg.style.left = "0";
  svg.style.width = "100%";
  svg.style.height = "100%";

  const stagePath = document.createElementNS("http://www.w3.org/2000/svg", "path");

  stagePath.setAttribute("d", generateStageSvgPathString(stage, stageOptions(ctx)));

  stagePath.style.fill = ctx.getConfig("overlayColor") || "rgb(0,0,0)";
  stagePath.style.opacity = `${ctx.getConfig("overlayOpacity")}`;
  stagePath.style.pointerEvents = "auto";
  stagePath.style.cursor = "auto";

  svg.appendChild(stagePath);

  return svg;
}

export function destroyOverlay(ctx: Context) {
  const overlaySvg = ctx.getState("__overlaySvg");
  if (overlaySvg) {
    destroyDriverClick(overlaySvg);
    overlaySvg.remove();
  }
}

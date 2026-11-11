export type StageDefinition = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type StageOptions = {
  padding: number;
  radius: number;
};

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function stageViewBox(): string {
  return `0 0 ${window.innerWidth} ${window.innerHeight}`;
}

export function createStageSvg(className: string, path: string, fill: string, opacity: number | string): SVGSVGElement {
  const svg = document.createElementNS(SVG_NAMESPACE, "svg");
  svg.setAttribute("class", className);
  svg.setAttribute("viewBox", stageViewBox());
  svg.setAttribute("preserveAspectRatio", "xMinYMin slice");
  svg.style.fillRule = "evenodd";

  const stagePath = document.createElementNS(SVG_NAMESPACE, "path");
  stagePath.setAttribute("d", path);
  stagePath.style.fill = fill;
  stagePath.style.opacity = `${opacity}`;
  stagePath.style.pointerEvents = "auto";
  svg.appendChild(stagePath);

  return svg;
}

export type StageCutout = StageDefinition & { radius: number };

export function stageCutout(stage: StageDefinition, options: StageOptions): StageCutout {
  const width = stage.width + options.padding * 2;
  const height = stage.height + options.padding * 2;
  const limitedRadius = Math.min(options.radius, width / 2, height / 2);

  return {
    x: stage.x - options.padding,
    y: stage.y - options.padding,
    width,
    height,
    radius: Math.floor(Math.max(limitedRadius, 0)),
  };
}

export function generateStageSvgPathString(stage: StageDefinition, options: StageOptions) {
  const windowX = window.innerWidth;
  const windowY = window.innerHeight;

  const cutout = stageCutout(stage, options);
  const normalizedRadius = cutout.radius;

  const highlightBoxX = cutout.x + normalizedRadius;
  const highlightBoxY = cutout.y;
  const highlightBoxWidth = cutout.width - normalizedRadius * 2;
  const highlightBoxHeight = cutout.height - normalizedRadius * 2;

  return `M${windowX},0L0,0L0,${windowY}L${windowX},${windowY}L${windowX},0Z
    M${highlightBoxX},${highlightBoxY} h${highlightBoxWidth} a${normalizedRadius},${normalizedRadius} 0 0 1 ${normalizedRadius},${normalizedRadius} v${highlightBoxHeight} a${normalizedRadius},${normalizedRadius} 0 0 1 -${normalizedRadius},${normalizedRadius} h-${highlightBoxWidth} a${normalizedRadius},${normalizedRadius} 0 0 1 -${normalizedRadius},-${normalizedRadius} v-${highlightBoxHeight} a${normalizedRadius},${normalizedRadius} 0 0 1 ${normalizedRadius},-${normalizedRadius} z`;
}

type Rect = StageDefinition;

function isInside(rect: Rect, x: number, y: number): boolean {
  return x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height;
}

export function generateExtraCutoutsPathString(cutout: StageCutout, rects: Rect[]): string {
  const isInsideExtraCutout = (x: number, y: number) => rects.some(rect => isInside(rect, x, y));
  const gridLines = (start: "x" | "y", size: "width" | "height") =>
    [...new Set([cutout, ...rects].flatMap(rect => [rect[start], rect[start] + rect[size]]))].sort((a, b) => a - b);
  const columns = gridLines("x", "width");
  const rows = gridLines("y", "height");
  let path = "";

  columns.forEach((x, column) => {
    rows.forEach((y, row) => {
      const width = columns[column + 1] - x;
      const height = rows[row + 1] - y;
      const centerX = x + width / 2;
      const centerY = y + height / 2;
      if (isInsideExtraCutout(centerX, centerY) && !isInside(cutout, centerX, centerY)) {
        path += `M${x},${y}h${width}v${height}h-${width}z`;
      }
    });
  });

  const r = cutout.radius;
  for (const isRight of [0, 1]) {
    for (const isBottom of [0, 1]) {
      const cornerX = cutout.x + isRight * cutout.width;
      const cornerY = cutout.y + isBottom * cutout.height;
      const towardsCenterX = isRight ? -r : r;
      const towardsCenterY = isBottom ? -r : r;
      if (r && isInsideExtraCutout(cornerX + towardsCenterX / 2, cornerY + towardsCenterY / 2)) {
        path += `M${cornerX},${cornerY}h${towardsCenterX}a${r},${r} 0 0 ${isRight ^ isBottom} ${-towardsCenterX},${towardsCenterY}z`;
      }
    }
  }

  return path;
}

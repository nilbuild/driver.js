// Pure geometry of the stage, the cutout in the full-screen dim that keeps
// the highlighted element visible. Shared by the tour and hints overlays,
// each passing its own padding and radius.

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

// The full-screen dim with a rounded cutout, as a single evenodd path.
export function generateStageSvgPathString(stage: StageDefinition, options: StageOptions) {
  const windowX = window.innerWidth;
  const windowY = window.innerHeight;

  const stagePadding = options.padding;
  const stageRadius = options.radius;

  const stageWidth = stage.width + stagePadding * 2;
  const stageHeight = stage.height + stagePadding * 2;

  // prevent glitches when stage is too small for radius
  const limitedRadius = Math.min(stageRadius, stageWidth / 2, stageHeight / 2);

  const normalizedRadius = Math.floor(Math.max(limitedRadius, 0));

  const highlightBoxX = stage.x - stagePadding + normalizedRadius;
  const highlightBoxY = stage.y - stagePadding;
  const highlightBoxWidth = stageWidth - normalizedRadius * 2;
  const highlightBoxHeight = stageHeight - normalizedRadius * 2;

  return `M${windowX},0L0,0L0,${windowY}L${windowX},${windowY}L${windowX},0Z
    M${highlightBoxX},${highlightBoxY} h${highlightBoxWidth} a${normalizedRadius},${normalizedRadius} 0 0 1 ${normalizedRadius},${normalizedRadius} v${highlightBoxHeight} a${normalizedRadius},${normalizedRadius} 0 0 1 -${normalizedRadius},${normalizedRadius} h-${highlightBoxWidth} a${normalizedRadius},${normalizedRadius} 0 0 1 -${normalizedRadius},-${normalizedRadius} v-${highlightBoxHeight} a${normalizedRadius},${normalizedRadius} 0 0 1 ${normalizedRadius},-${normalizedRadius} z`;
}

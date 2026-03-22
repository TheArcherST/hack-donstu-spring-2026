export const MIN_GAME_VIEWPORT_ASPECT = 390 / 844;
export const MAX_GAME_VIEWPORT_ASPECT = 0.62;

export interface FittedViewport {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
  aspect: number;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function fitViewport(containerWidth: number, containerHeight: number): FittedViewport {
  const safeWidth = Math.max(1, containerWidth);
  const safeHeight = Math.max(1, containerHeight);
  const aspect = clamp(safeWidth / safeHeight, MIN_GAME_VIEWPORT_ASPECT, MAX_GAME_VIEWPORT_ASPECT);

  if (safeWidth / safeHeight > aspect) {
    const height = safeHeight;
    const width = Math.round(height * aspect);
    return {
      width,
      height,
      offsetX: Math.round((safeWidth - width) / 2),
      offsetY: 0,
      aspect,
    };
  }

  const width = safeWidth;
  const height = Math.round(width / aspect);
  return {
    width,
    height,
    offsetX: 0,
    offsetY: Math.max(0, safeHeight - height),
    aspect,
  };
}

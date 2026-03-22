export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function isQuarterTurn(rotation: number) {
  const quarterTurns = Math.round(rotation / (Math.PI / 2));
  return Math.abs(quarterTurns) % 2 === 1;
}

export function getFittedDrawRect(
  sourceWidth: number,
  sourceHeight: number,
  rect: Rect,
  fit: "cover" | "contain",
  alignX = 0.5,
  alignY = 0.5,
) {
  const scale =
    fit === "cover"
      ? Math.max(rect.width / sourceWidth, rect.height / sourceHeight)
      : Math.min(rect.width / sourceWidth, rect.height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return {
    x: rect.x + (rect.width - drawWidth) * alignX,
    y: rect.y + (rect.height - drawHeight) * alignY,
    width: drawWidth,
    height: drawHeight,
  };
}

export function getTextureContainSize(
  sourceWidth: number,
  sourceHeight: number,
  frameWidth: number,
  frameHeight: number,
  rotation = 0,
) {
  const rotated = isQuarterTurn(rotation);
  const fitWidth = rotated ? frameHeight : frameWidth;
  const fitHeight = rotated ? frameWidth : frameHeight;
  const scale = Math.min(fitWidth / sourceWidth, fitHeight / sourceHeight);
  return {
    drawWidth: sourceWidth * scale,
    drawHeight: sourceHeight * scale,
  };
}

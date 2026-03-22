import { BOARD_ROWS } from "./board.ts";
import { buildBlockGeometry, getCellPaintRect } from "./blockGeometry.ts";
import { getFittedDrawRect, getTextureContainSize } from "./renderMath.ts";
import { SCENE_LAYER_ORDER, type SceneLayer } from "./renderLayers.ts";
import { SCENE_ASSETS, getSceneLayout } from "./scene.ts";
import type { AttackProjectile, CableSegment, Cell, GameSnapshot, Piece, SignalPacket } from "./types.ts";

interface RenderPoint {
  col: number;
  row: number;
}

interface TextureVariant {
  src: string;
  rotation?: number;
  sourceRect?: SourceRect;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface SourceRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PoleSecurityTrailState {
  elapsedSeconds: number;
  segmentAlphas: number[];
  status: GameSnapshot["status"] | null;
}

interface PoleSecurityMaskSurface {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

const DAMAGE_TEXTURES = ["/texture-pack/damage_overlay_1.png", "/texture-pack/damage_overlay_2.png"];
const SQUARE_CONTAINER_SPRITESHEET = "/texture-pack/container_2-2_default_spritesheet.png";
const RECTANGLE_CONTAINER_SPRITESHEET = "/texture-pack/container_3-2_default_spritesheet.png";
const SQUARE_CONTAINER_FRAME_COUNT = 3;
const RECTANGLE_CONTAINER_FRAME_COUNT = 3;
const SIGNAL_SPRITE_FRAME_COUNT = 24;
const ATTACK_BULLET_SPRITE = "/attack/bullet-spritesheet.png";
const ATTACK_PROJECTILE_TRAVEL_MS = 680;
const DAMAGE_LABEL_VISIBLE_MS = 1_500;
const POLE_SECURITY_RESPONSE_MS = 5_000;
const POLE_SECURITY_DIFFUSION_MS = 1_350;
const POLE_SECURITY_STEP_MS = 32;
const imageCache = new Map<string, HTMLImageElement>();
const poleSecurityTrailCache = new WeakMap<HTMLCanvasElement, PoleSecurityTrailState>();
const poleSecurityMaskCache = new WeakMap<HTMLCanvasElement, PoleSecurityMaskSurface>();

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function lerp(start: number, end: number, t: number) {
  return start + (end - start) * t;
}

function smoothstep(t: number) {
  const clamped = clamp(t, 0, 1);
  return clamped * clamped * (3 - 2 * clamped);
}

function getTexture(src: string) {
  let image = imageCache.get(src);
  if (!image && typeof Image !== "undefined") {
    image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return image;
}

function drawImageFitInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  options?: {
    alpha?: number;
    alignX?: number;
    alignY?: number;
    fit?: "cover" | "contain";
    sourceRect?: SourceRect;
  },
) {
  const sourceRect = options?.sourceRect ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
  const drawRect = getFittedDrawRect(
    sourceRect.width,
    sourceRect.height,
    rect,
    options?.fit ?? "contain",
    options?.alignX ?? 0.5,
    options?.alignY ?? 0.5,
  );

  ctx.save();
  ctx.globalAlpha = options?.alpha ?? 1;
  ctx.drawImage(
    image,
    sourceRect.x,
    sourceRect.y,
    sourceRect.width,
    sourceRect.height,
    drawRect.x,
    drawRect.y,
    drawRect.width,
    drawRect.height,
  );
  ctx.restore();
}

function drawImageCoverInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  alpha = 1,
  alignX = 0.5,
  alignY = 0.5,
) {
  drawImageFitInRect(ctx, image, rect, { alpha, alignX, alignY, fit: "cover" });
}

function drawImageContainInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  alpha = 1,
  alignX = 0.5,
  alignY = 0.5,
  sourceRect?: SourceRect,
) {
  drawImageFitInRect(ctx, image, rect, { alpha, alignX, alignY, fit: "contain", sourceRect });
}

function drawImageStretchInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  alpha = 1,
  sourceRect?: SourceRect,
) {
  const source = sourceRect ?? {
    x: 0,
    y: 0,
    width: image.naturalWidth,
    height: image.naturalHeight,
  };

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, source.x, source.y, source.width, source.height, rect.x, rect.y, rect.width, rect.height);
  ctx.restore();
}

function collectBlocks(snapshot: GameSnapshot) {
  const blocks = new Map<number, { cell: Cell; cells: RenderPoint[] }>();
  snapshot.grid.forEach((row, rowIndex) => {
    row.forEach((cell, colIndex) => {
      if (!cell) {
        return;
      }
      const block = blocks.get(cell.blockId);
      if (block) {
        block.cells.push({ col: colIndex, row: rowIndex });
      } else {
        blocks.set(cell.blockId, { cell, cells: [{ col: colIndex, row: rowIndex }] });
      }
    });
  });
  return [...blocks.values()];
}

function getPieceCells(piece: Piece): RenderPoint[] {
  return piece.shape[piece.rotation % piece.shape.length].map((cell) => ({ col: piece.x + cell.x, row: piece.y + cell.y }));
}

function pickBaseTexture(cell: Cell): TextureVariant {
  const containerFrame = getContainerSpritesheetFrame(cell.textureSrc, cell.durability, cell.maxDurability);
  const containerFrameCount = getContainerSpritesheetFrameCount(cell.textureSrc);
  if (containerFrame !== null && containerFrameCount !== null) {
    return {
      src: cell.textureSrc ?? "",
      rotation: cell.textureRotation,
      sourceRect: {
        x: containerFrame,
        y: 0,
        width: containerFrameCount,
        height: 1,
      },
    };
  }

  return {
    src: cell.textureSrc ?? "",
    rotation: cell.textureRotation,
  };
}

function getContainerSpritesheetFrameCount(textureSrc: string | null) {
  if (textureSrc === SQUARE_CONTAINER_SPRITESHEET) {
    return SQUARE_CONTAINER_FRAME_COUNT;
  }
  if (textureSrc === RECTANGLE_CONTAINER_SPRITESHEET) {
    return RECTANGLE_CONTAINER_FRAME_COUNT;
  }
  return null;
}

export function getContainerSpritesheetFrame(textureSrc: string | null, durability: number, maxDurability: number) {
  if (getContainerSpritesheetFrameCount(textureSrc) === null || maxDurability <= 0) {
    return null;
  }

  if (durability >= maxDurability) {
    return 0;
  }

  return durability <= Math.max(1, Math.floor(maxDurability * 0.45)) ? 2 : 1;
}

function getCellRect(layout: ReturnType<typeof getSceneLayout>, col: number, row: number): Rect {
  return {
    x: layout.laneCenters[col] - layout.cellSize / 2,
    y: layout.rowTops[row],
    width: layout.cellSize,
    height: layout.cellSize,
  };
}

function getCellPaintedRect(layout: ReturnType<typeof getSceneLayout>, col: number, row: number): Rect {
  return getCellPaintRect(
    {
      boardLeft: layout.boardLeft,
      boardTop: layout.gridTop,
      boardCols: layout.laneCenters.length,
      boardRows: layout.rowTops.length,
      cellSize: layout.cellSize,
      cellGap: layout.cellGap,
      rowGap: layout.rowGap,
    },
    col,
    row,
  );
}

function buildBlockPath(layout: ReturnType<typeof getSceneLayout>, cells: RenderPoint[]) {
  const path = new Path2D();
  const geometry = buildBlockGeometry(cells, (col, row) => getCellPaintedRect(layout, col, row));

  for (const rect of geometry) {
    path.rect(rect.x, rect.y, rect.width, rect.height);
  }
  return path;
}

function getBlockRectBounds(layout: ReturnType<typeof getSceneLayout>, cells: RenderPoint[]) {
  return cells.reduce(
    (bounds, cell) => {
      const rect = getCellPaintedRect(layout, cell.col, cell.row);
      return {
        minX: Math.min(bounds.minX, rect.x),
        minY: Math.min(bounds.minY, rect.y),
        maxX: Math.max(bounds.maxX, rect.x + rect.width),
        maxY: Math.max(bounds.maxY, rect.y + rect.height),
      };
    },
    { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
  );
}

function drawBlockTexture(ctx: CanvasRenderingContext2D, texture: TextureVariant, path: Path2D, x: number, y: number, width: number, height: number) {
  if (!texture.src) {
    return;
  }
  const image = getTexture(texture.src);
  if (!image || !image.complete || image.naturalWidth === 0) {
    return;
  }
  ctx.save();
  ctx.clip(path);
  drawTextureContain(ctx, image, x, y, width, height, texture.rotation ?? 0, texture.sourceRect);
  ctx.restore();
}

function drawTextureContain(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
  sourceRect?: SourceRect,
) {
  const source = sourceRect
    ? {
        x: image.naturalWidth * (sourceRect.x / sourceRect.width),
        y: image.naturalHeight * (sourceRect.y / sourceRect.height),
        width: image.naturalWidth / sourceRect.width,
        height: image.naturalHeight / sourceRect.height,
      }
    : {
        x: 0,
        y: 0,
        width: image.naturalWidth,
        height: image.naturalHeight,
      };
  const { drawWidth, drawHeight } = getTextureContainSize(
    source.width,
    source.height,
    width,
    height,
    rotation,
  );

  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, source.x, source.y, source.width, source.height, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
}

function drawMetalSurface(
  ctx: CanvasRenderingContext2D,
  cell: Cell,
  path: Path2D,
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
) {
  ctx.save();
  ctx.clip(path);

  const gradient = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.maxY);
  gradient.addColorStop(0, cell.category === "guard" ? "#8096aa" : cell.category === "audit" ? "#8d99a6" : "#7a858f");
  gradient.addColorStop(0.5, cell.category === "guard" ? "#55687a" : cell.category === "audit" ? "#5f6a76" : "#4d5863");
  gradient.addColorStop(1, "#2a3138");
  ctx.fillStyle = gradient;
  ctx.fill(path);

  const sheen = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.maxX, bounds.minY);
  sheen.addColorStop(0, "rgba(255,255,255,0.18)");
  sheen.addColorStop(0.3, "rgba(255,255,255,0.05)");
  sheen.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = sheen;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  ctx.globalAlpha = 0.12;
  for (let offset = -bounds.maxY; offset < bounds.maxX; offset += 14) {
    ctx.strokeStyle = "rgba(255,255,255,0.5)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bounds.minX + offset, bounds.maxY);
    ctx.lineTo(bounds.minX + offset + (bounds.maxY - bounds.minY), bounds.minY);
    ctx.stroke();
  }

  ctx.restore();
}

function drawBackground(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  const sky = ctx.createLinearGradient(0, 0, 0, layout.height);
  sky.addColorStop(0, "#d8ebff");
  sky.addColorStop(0.38, "#c3dffc");
  sky.addColorStop(0.7, "#8aa26d");
  sky.addColorStop(1, "#273523");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const halo = ctx.createRadialGradient(layout.poleAxisX, layout.safeTop * 0.8, 18, layout.poleAxisX, layout.safeTop * 0.8, layout.width * 0.32);
  halo.addColorStop(0, snapshot.channelState === "guarded" ? "rgba(119,223,255,0.52)" : snapshot.channelState === "partial" ? "rgba(255,210,133,0.4)" : "rgba(255,122,122,0.34)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, layout.width, layout.height);

  const facade = getTexture(SCENE_ASSETS.background);
  if (facade && facade.complete && facade.naturalWidth > 0) {
    drawImageCoverInRect(ctx, facade, { x: 0, y: 0, width: layout.width, height: layout.height }, 0.98, 0.5, 1);
  }

  ctx.save();
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let row = 0; row <= BOARD_ROWS; row += 1) {
    const y = row === BOARD_ROWS ? layout.boardBottom : layout.rowTops[row] - layout.cellGap * 0.5;
    ctx.beginPath();
    ctx.moveTo(layout.boardLeft - 10, y);
    ctx.lineTo(layout.boardLeft + layout.boardWidth + 10, y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawPoleBackdrop(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof getSceneLayout>) {
  void ctx;
  void layout;
}

function drawPoleForeground(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof getSceneLayout>) {
  const pole = getTexture(SCENE_ASSETS.pole.src);
  if (pole && pole.complete && pole.naturalWidth > 0) {
    const poleRect = getPoleRect(layout);
    ctx.save();
    drawImageStretchInRect(ctx, pole, poleRect);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = "rgba(173, 229, 255, 0.18)";
  ctx.lineWidth = Math.max(2, layout.cellSize * 0.08);
  ctx.beginPath();
  ctx.moveTo(layout.poleAxisX, layout.gridTop - layout.cellSize * 0.55);
  ctx.lineTo(layout.poleAxisX, layout.boardBottom + layout.cellSize * 0.2);
  ctx.stroke();
  ctx.restore();
}

function getPoleRect(layout: ReturnType<typeof getSceneLayout>): Rect {
  return {
    x: layout.poleAxisX - layout.poleWidth / 2,
    y: layout.poleTop,
    width: layout.poleWidth,
    height: layout.poleBottom - layout.poleTop,
  };
}

function getPoleSecurityTrailState(canvas: HTMLCanvasElement, segmentCount: number) {
  const cached = poleSecurityTrailCache.get(canvas);
  if (cached && cached.segmentAlphas.length === segmentCount) {
    return cached;
  }
  const nextState: PoleSecurityTrailState = {
    elapsedSeconds: 0,
    segmentAlphas: Array.from({ length: segmentCount }, () => 0),
    status: null,
  };
  poleSecurityTrailCache.set(canvas, nextState);
  return nextState;
}

function getPoleSecurityMaskSurface(canvas: HTMLCanvasElement, width: number, height: number) {
  const nextWidth = Math.max(1, Math.round(width));
  const nextHeight = Math.max(1, Math.round(height));
  const cached = poleSecurityMaskCache.get(canvas);
  if (cached && cached.width === nextWidth && cached.height === nextHeight) {
    return cached;
  }
  if (typeof document === "undefined") {
    return null;
  }
  const maskCanvas = document.createElement("canvas");
  maskCanvas.width = nextWidth;
  maskCanvas.height = nextHeight;
  const maskCtx = maskCanvas.getContext("2d");
  if (!maskCtx) {
    return null;
  }
  const nextSurface: PoleSecurityMaskSurface = {
    canvas: maskCanvas,
    ctx: maskCtx,
    width: nextWidth,
    height: nextHeight,
  };
  poleSecurityMaskCache.set(canvas, nextSurface);
  return nextSurface;
}

function updatePoleSecurityTrail(
  trailState: PoleSecurityTrailState,
  segments: CableSegment[],
  snapshot: GameSnapshot,
  deltaMs: number,
) {
  const shouldReset =
    trailState.status !== null &&
    snapshot.status === "running" &&
    (snapshot.elapsedSeconds < trailState.elapsedSeconds || trailState.status !== "running");

  if (shouldReset) {
    trailState.segmentAlphas.fill(0);
  }

  let remainingMs = Math.max(0, deltaMs);
  while (remainingMs > 0) {
    const stepMs = Math.min(POLE_SECURITY_STEP_MS, remainingMs);
    const current = [...trailState.segmentAlphas];
    const pull = 1 - Math.exp(-stepMs / POLE_SECURITY_RESPONSE_MS);
    const diffusion = stepMs / POLE_SECURITY_DIFFUSION_MS;

    for (let index = 0; index < segments.length; index += 1) {
      const target = clamp(segments[index]?.expectedProtection ?? segments[index]?.protection ?? 0, 0, 1);
      const left = index > 0 ? current[index - 1] : current[index];
      const right = index < current.length - 1 ? current[index + 1] : current[index];
      const laplacian = left + right - current[index] * 2;
      const nextValue = current[index] + (target - current[index]) * pull + laplacian * diffusion;
      trailState.segmentAlphas[index] = clamp(nextValue, 0, 1);
    }

    remainingMs -= stepMs;
  }

  trailState.elapsedSeconds = snapshot.elapsedSeconds;
  trailState.status = snapshot.status;
  return trailState.segmentAlphas;
}

function samplePoleSecurityAlpha(
  segmentAlphas: number[],
  rowCenters: number[],
  localY: number,
) {
  if (segmentAlphas.length === 0) {
    return 0;
  }

  if (localY <= rowCenters[0]) {
    return segmentAlphas[0];
  }

  for (let index = 0; index < rowCenters.length - 1; index += 1) {
    const start = rowCenters[index];
    const end = rowCenters[index + 1];
    if (localY <= end) {
      return lerp(segmentAlphas[index], segmentAlphas[index + 1], smoothstep((localY - start) / Math.max(1, end - start)));
    }
  }

  return segmentAlphas[segmentAlphas.length - 1];
}

function drawPoleSecurityEffect(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof getSceneLayout>,
  segmentAlphas: number[],
) {
  const effectTexture = getTexture(SCENE_ASSETS.poleSecurityEffect.src);
  if (!effectTexture || !effectTexture.complete || effectTexture.naturalWidth === 0) {
    return;
  }

  const poleRect = getPoleRect(layout);
  const maskSurface = getPoleSecurityMaskSurface(ctx.canvas, poleRect.width, poleRect.height);
  if (!maskSurface) {
    return;
  }

  const maskTop = 0;
  const maskBottom = poleRect.height;
  const gradient = maskSurface.ctx.createLinearGradient(0, 0, 0, poleRect.height);
  const rowCenters = segmentAlphas.map((_, row) => clamp(layout.rowCenters[row] - poleRect.y, maskTop, maskBottom));
  const sampleCount = Math.max(segmentAlphas.length * 5, Math.ceil((maskBottom - maskTop) / 10));

  for (let sampleIndex = 0; sampleIndex <= sampleCount; sampleIndex += 1) {
    const sampleY = lerp(maskTop, maskBottom, sampleIndex / Math.max(1, sampleCount));
    const offset = poleRect.height > 0 ? sampleY / poleRect.height : 0;
    const alpha = samplePoleSecurityAlpha(segmentAlphas, rowCenters, sampleY);
    gradient.addColorStop(offset, `rgba(0,0,0,${alpha})`);
  }

  maskSurface.ctx.clearRect(0, 0, maskSurface.width, maskSurface.height);
  drawImageStretchInRect(maskSurface.ctx, effectTexture, {
    x: 0,
    y: 0,
    width: poleRect.width,
    height: poleRect.height,
  });
  maskSurface.ctx.globalCompositeOperation = "destination-in";
  maskSurface.ctx.fillStyle = gradient;
  maskSurface.ctx.fillRect(0, 0, maskSurface.width, maskSurface.height);
  maskSurface.ctx.globalCompositeOperation = "source-over";

  ctx.save();
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 0.96;
  ctx.drawImage(maskSurface.canvas, poleRect.x, poleRect.y, poleRect.width, poleRect.height);
  ctx.globalCompositeOperation = "lighter";
  ctx.globalAlpha = 0.18;
  ctx.drawImage(maskSurface.canvas, poleRect.x, poleRect.y, poleRect.width, poleRect.height);
  ctx.restore();
}

function getPacketFrame(packet: SignalPacket) {
  if (packet.state === "dropping" && packet.frozenFrame !== null) {
    return packet.frozenFrame;
  }
  const normalized = clamp((BOARD_ROWS - packet.progress) / (BOARD_ROWS + 0.25), 0, 1);
  return Math.min(SIGNAL_SPRITE_FRAME_COUNT - 1, Math.floor(normalized * SIGNAL_SPRITE_FRAME_COUNT));
}

function drawSignalPackets(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  const signalSheet = getTexture(SCENE_ASSETS.poleSignal.src);
  if (!signalSheet || !signalSheet.complete || signalSheet.naturalWidth === 0) {
    return;
  }

  const poleRect = getPoleRect(layout);
  const corridor = ctx.createLinearGradient(0, poleRect.y, 0, poleRect.y + poleRect.height);
  corridor.addColorStop(0, "rgba(255,255,255,0)");
  corridor.addColorStop(0.25, snapshot.channelState === "guarded" ? "rgba(110, 235, 255, 0.12)" : snapshot.channelState === "partial" ? "rgba(255, 213, 130, 0.1)" : "rgba(255, 118, 118, 0.12)");
  corridor.addColorStop(1, "rgba(255,255,255,0)");

  ctx.save();
  ctx.fillStyle = corridor;
  ctx.fillRect(layout.poleAxisX - layout.poleWidth * 0.22, layout.gridTop, layout.poleWidth * 0.44, layout.boardBottom - layout.gridTop);
  ctx.restore();

  const frameWidth = signalSheet.naturalWidth / SIGNAL_SPRITE_FRAME_COUNT;
  const frameHeight = signalSheet.naturalHeight;

  for (const packet of snapshot.signalPackets) {
    const frameIndex = getPacketFrame(packet);
    const alpha =
      packet.state === "dropping"
        ? clamp(packet.brightness * 0.9, 0, 0.78)
        : clamp(0.38 + packet.brightness * 0.46 - packet.corrupted * 0.08, 0.34, 0.92);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    drawImageContainInRect(ctx, signalSheet, poleRect, alpha, 0.5, 0.5, {
      x: Math.round(frameIndex * frameWidth),
      y: 0,
      width: frameWidth,
      height: frameHeight,
    });
    ctx.restore();
  }
}

function drawSlotGrid(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof getSceneLayout>) {
  ctx.save();
  const beamWidth = layout.cellSize * 0.82;
  const shaftGradient = ctx.createLinearGradient(0, layout.gridTop, 0, layout.boardBottom);
  shaftGradient.addColorStop(0, "rgba(132, 213, 255, 0.06)");
  shaftGradient.addColorStop(0.5, "rgba(17, 36, 50, 0.05)");
  shaftGradient.addColorStop(1, "rgba(5, 12, 18, 0.04)");

  for (const laneCenter of layout.laneCenters) {
    ctx.fillStyle = shaftGradient;
    ctx.fillRect(laneCenter - beamWidth / 2, layout.gridTop, beamWidth, layout.gridHeight);
  }
  ctx.restore();
}

function getAttackPath(layout: ReturnType<typeof getSceneLayout>, projectile: AttackProjectile) {
  const y = layout.rowCenters[projectile.row];
  const startX = projectile.side === "left" ? -layout.cellSize * 0.75 : layout.width + layout.cellSize * 0.75;
  const endX =
    projectile.impact === "block" && projectile.targetCol !== null
      ? layout.laneCenters[projectile.targetCol]
      : layout.poleAxisX;
  const controlX =
    projectile.side === "left"
      ? lerp(layout.width * 0.16, endX - layout.cellSize * 0.65, 0.45)
      : lerp(layout.width * 0.84, endX + layout.cellSize * 0.65, 0.45);
  const controlY = y - layout.cellSize * 0.42;

  return { startX, endX, y, controlX, controlY };
}

function sampleQuadraticPoint(start: number, control: number, end: number, t: number) {
  const inverse = 1 - t;
  return inverse * inverse * start + 2 * inverse * t * control + t * t * end;
}

function sampleQuadraticTangent(start: number, control: number, end: number, t: number) {
  return 2 * (1 - t) * (control - start) + 2 * t * (end - control);
}

function drawAttackProjectiles(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  const bulletSheet = getTexture(ATTACK_BULLET_SPRITE);
  if (!bulletSheet || !bulletSheet.complete || bulletSheet.naturalWidth === 0) {
    return;
  }

  const frameSize = bulletSheet.naturalHeight;
  const frameCount = Math.max(1, Math.round(bulletSheet.naturalWidth / frameSize));
  const bulletSize = layout.cellSize * 2.35;

  for (const projectile of snapshot.attackProjectiles) {
    const progress = clamp(projectile.age / ATTACK_PROJECTILE_TRAVEL_MS, 0, 1);
    const eased = 1 - (1 - progress) * (1 - progress);
    const path = getAttackPath(layout, projectile);
    const x = sampleQuadraticPoint(path.startX, path.controlX, path.endX, eased);
    const y = sampleQuadraticPoint(path.y, path.controlY, path.y, eased);
    const tangentX = sampleQuadraticTangent(path.startX, path.controlX, path.endX, eased);
    const tangentY = sampleQuadraticTangent(path.y, path.controlY, path.y, eased);
    const frameIndex = Math.min(frameCount - 1, Math.floor(projectile.age / 80) % frameCount);
    const trailStartX = sampleQuadraticPoint(path.startX, path.controlX, path.endX, Math.max(0, eased - 0.06));
    const trailStartY = sampleQuadraticPoint(path.y, path.controlY, path.y, Math.max(0, eased - 0.06));

    ctx.save();
    ctx.strokeStyle = "rgba(255, 124, 167, 0.5)";
    ctx.lineWidth = Math.max(2.5, layout.cellSize * 0.12);
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(trailStartX, trailStartY);
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.atan2(tangentY, tangentX));
    ctx.shadowBlur = layout.cellSize * 0.82;
    ctx.shadowColor = "rgba(255, 120, 165, 0.75)";
    ctx.globalAlpha = clamp(0.72 + (1 - progress) * 0.28, 0.72, 1);
    drawImageStretchInRect(
      ctx,
      bulletSheet,
      { x: -bulletSize * 0.5, y: -bulletSize * 0.5, width: bulletSize, height: bulletSize },
      1,
      {
        x: frameIndex * frameSize,
        y: 0,
        width: frameSize,
        height: frameSize,
      },
    );
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = 0.28;
    drawImageStretchInRect(
      ctx,
      bulletSheet,
      { x: -bulletSize * 0.58, y: -bulletSize * 0.58, width: bulletSize * 1.16, height: bulletSize * 1.16 },
      1,
      {
        x: frameIndex * frameSize,
        y: 0,
        width: frameSize,
        height: frameSize,
      },
    );
    ctx.restore();
  }
}

function drawDamageLabels(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  for (const label of snapshot.damageLabels) {
    const visibleAge = label.age - label.delayMs;
    if (visibleAge < 0) {
      continue;
    }

    const image = getTexture(label.textureSrc);
    if (!image || !image.complete || image.naturalWidth === 0) {
      continue;
    }

    const progress = clamp(visibleAge / DAMAGE_LABEL_VISIBLE_MS, 0, 1);
    const fadeIn = smoothstep(progress / 0.16);
    const fadeOut = 1 - smoothstep(Math.max(0, progress - 0.52) / 0.48);
    const alpha = clamp(fadeIn * fadeOut, 0, 1);
    const size = layout.cellSize * 3.15;
    const x = layout.poleAxisX + (label.side === "left" ? -layout.cellSize * 0.95 : layout.cellSize * 0.95) - size / 2;
    const y = layout.rowCenters[label.row] - size / 2;

    ctx.save();
    ctx.globalAlpha = clamp(alpha, 0, 1);
    ctx.shadowBlur = layout.cellSize * 0.5;
    ctx.shadowColor = "rgba(255, 98, 134, 0.45)";
    drawImageContainInRect(ctx, image, { x, y, width: size, height: size });
    ctx.restore();
  }
}

function drawBlockGroup(
  ctx: CanvasRenderingContext2D,
  layout: ReturnType<typeof getSceneLayout>,
  cell: Cell,
  cells: RenderPoint[],
  active = false,
) {
  if (cells.length === 0) {
    return;
  }

  const path = buildBlockPath(layout, cells);
  const bounds = getBlockRectBounds(layout, cells);
  const baseTexture = pickBaseTexture(cell);
  const usesContainerSpritesheet = getContainerSpritesheetFrame(cell.textureSrc, cell.durability, cell.maxDurability) !== null;
  const damageTexture =
    !usesContainerSpritesheet && cell.durability < cell.maxDurability
      ? { src: DAMAGE_TEXTURES[cell.durability <= Math.max(1, Math.floor(cell.maxDurability * 0.45)) ? 1 : 0] }
      : null;

  if (cell.surfaceStyle === "textured" && cell.textureSrc) {
    drawBlockTexture(ctx, baseTexture, path, bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  } else {
    ctx.save();
    ctx.shadowBlur = active ? 22 : 12;
    ctx.shadowColor = active ? "rgba(255,255,255,0.42)" : cell.category === "guard" || cell.audited ? "rgba(26, 144, 255, 0.34)" : "rgba(12, 17, 24, 0.38)";
    ctx.shadowOffsetY = layout.cellSize * 0.12;
    ctx.fillStyle = "rgba(6, 10, 16, 0.28)";
    ctx.fill(path);
    ctx.restore();
    drawMetalSurface(ctx, cell, path, bounds);
  }

  if (damageTexture) {
    drawBlockTexture(ctx, damageTexture, path, bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  }

  if (cell.flash > 0) {
    ctx.save();
    ctx.globalAlpha = cell.flash * 0.18;
    ctx.fillStyle = "#ffffff";
    ctx.fill(path);
    ctx.restore();
  }
}

function drawAuditBursts(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  snapshot.auditBursts.forEach((burst) => {
    const rect = getCellRect(layout, Math.round(burst.x), Math.round(burst.y));
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const progress = burst.age / 720;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "rgba(116, 212, 255, 0.85)";
    ctx.lineWidth = Math.max(2, layout.cellSize * 0.07);
    ctx.beginPath();
    ctx.arc(centerX, centerY, layout.cellSize * 0.35 + progress * layout.cellSize * 1.3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawForeground(ctx: CanvasRenderingContext2D, layout: ReturnType<typeof getSceneLayout>) {
  const curb = getTexture(SCENE_ASSETS.foreground);
  if (curb && curb.complete && curb.naturalWidth > 0) {
    const aspectHeight = layout.width * (curb.naturalHeight / curb.naturalWidth);
    const height = Math.max(layout.curbHeight, aspectHeight);
    drawImageCoverInRect(
      ctx,
      curb,
      { x: 0, y: layout.foregroundTopY, width: layout.width, height },
      0.98,
      0.5,
      1,
    );
  }
}

function drawBlocksLayer(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  for (const block of collectBlocks(snapshot)) {
    drawBlockGroup(ctx, layout, block.cell, block.cells);
  }

  if (!snapshot.activePiece) {
    return;
  }

  drawBlockGroup(
    ctx,
    layout,
    {
      blockId: snapshot.activePiece.id,
      category: snapshot.activePiece.category,
      baseDurability: 1,
      durability: 1,
      maxDurability: 1,
      fortified: snapshot.activePiece.category === "guard" ? 2 : snapshot.activePiece.category === "audit" ? 1 : 0,
      audited: snapshot.activePiece.category === "guard" || snapshot.activePiece.category === "audit",
      flash: 0,
      surfaceStyle: snapshot.activePiece.surfaceStyle,
      textureSrc: snapshot.activePiece.textureSrc,
      textureRotation: snapshot.activePiece.textureRotation,
    },
    getPieceCells(snapshot.activePiece),
    true,
  );
}

function drawPoleLayer(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  layout: ReturnType<typeof getSceneLayout>,
  deltaMs: number,
) {
  const trailState = getPoleSecurityTrailState(ctx.canvas, snapshot.cableSegments.length);
  const segmentAlphas = updatePoleSecurityTrail(trailState, snapshot.cableSegments, snapshot, deltaMs);
  drawPoleForeground(ctx, layout);
  drawPoleSecurityEffect(ctx, layout, segmentAlphas);
}

function drawEffectsLayer(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot, layout: ReturnType<typeof getSceneLayout>) {
  drawSignalPackets(ctx, snapshot, layout);
  drawAttackProjectiles(ctx, snapshot, layout);
  drawDamageLabels(ctx, snapshot, layout);
  drawAuditBursts(ctx, snapshot, layout);
}

function renderSceneLayer(
  layer: SceneLayer,
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  layout: ReturnType<typeof getSceneLayout>,
  deltaMs: number,
) {
  switch (layer) {
    case "background":
      drawBackground(ctx, snapshot, layout);
      drawPoleBackdrop(ctx, layout);
      drawSlotGrid(ctx, layout);
      return;
    case "foreground":
      drawForeground(ctx, layout);
      return;
    case "blocks":
      drawBlocksLayer(ctx, snapshot, layout);
      return;
    case "pole":
      drawPoleLayer(ctx, snapshot, layout, deltaMs);
      return;
    case "effects":
      drawEffectsLayer(ctx, snapshot, layout);
      return;
  }
}

export function renderSnapshot(
  ctx: CanvasRenderingContext2D,
  snapshot: GameSnapshot,
  viewportWidth = ctx.canvas.width,
  viewportHeight = ctx.canvas.height,
  cameraLift = 0,
  deltaMs = 16.67,
) {
  const layout = getSceneLayout(viewportWidth, viewportHeight);

  ctx.clearRect(0, 0, layout.width, layout.height);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, layout.width, layout.height);
  ctx.clip();
  ctx.translate(0, cameraLift);

  for (const layer of SCENE_LAYER_ORDER) {
    renderSceneLayer(layer, ctx, snapshot, layout, deltaMs);
  }

  ctx.restore();
}

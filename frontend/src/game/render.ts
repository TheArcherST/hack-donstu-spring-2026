import { BLOCK_COLORS, BOARD_ROWS, CANVAS_HEIGHT, CANVAS_WIDTH } from "./constants";
import type { Cell, GameSnapshot, Piece, SignalPacket } from "./types";

interface RenderPoint {
  col: number;
  row: number;
}

interface TextureVariant {
  src: string;
  rotation?: number;
}

interface TextureFamily {
  square?: TextureVariant;
  wide?: TextureVariant;
  tall?: TextureVariant;
}

type BlockFormFactor = "square" | "wide" | "tall" | "other";

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface PolePlacement {
  src: string;
  x: number;
  y: number;
  width: number;
  height: number;
  visibility: number;
}

interface PoleSegmentDefinition {
  src: string;
  baseHeight: number;
  visibility: number;
}

const NORMAL_TEXTURES = [
  "/texture-pack/neutral_01.png",
  "/texture-pack/neutral_dark.png",
  "/texture-pack/neutral_signal.png",
];

const TECH_TEXTURES: TextureFamily[] = [
  { square: { src: "/texture-pack/ddg_core.png" } },
  { square: { src: "/texture-pack/postgres.png" } },
  { square: { src: "/texture-pack/nginx.png" } },
  {
    square: { src: "/texture-pack/docker-squre.png" },
    wide: { src: "/texture-pack/docker-rect.png" },
    tall: { src: "/texture-pack/docker-rect.png", rotation: Math.PI / 2 },
  },
  { square: { src: "/texture-pack/k8s.png" } },
];

const DAMAGE_TEXTURES = ["/texture-pack/damage_overlay_1.png", "/texture-pack/damage_overlay_2.png"];

const SCENE_BACKGROUND_LAYER = "/scene-layers/background_facade.png";
const SCENE_FOREGROUND_LAYER = "/scene-layers/foreground_curb.png";

const POLE_TOP: PoleSegmentDefinition = { src: "/pole-pack/top_exit_aligned.png", baseHeight: 102, visibility: 0.5 };
const POLE_REPEAT: PoleSegmentDefinition = { src: "/pole-pack/repeat_tile_256w.png", baseHeight: 213, visibility: 0.62 };
const POLE_CABLE: PoleSegmentDefinition = { src: "/pole-pack/cable_bundle_aligned.png", baseHeight: 298, visibility: 1 };
const POLE_CONTROL: PoleSegmentDefinition = { src: "/pole-pack/control_box_aligned.png", baseHeight: 268, visibility: 0.44 };
const POLE_BOTTOM: PoleSegmentDefinition = { src: "/pole-pack/bottom_post_aligned.png", baseHeight: 216, visibility: 0.28 };
const imageCache = new Map<string, HTMLImageElement>();

function getTexture(src: string) {
  let image = imageCache.get(src);
  if (!image && typeof Image !== "undefined") {
    image = new Image();
    image.src = src;
    imageCache.set(src, image);
  }
  return image;
}

function getBounds(cells: RenderPoint[]) {
  return cells.reduce(
    (bounds, cell) => ({
      minCol: Math.min(bounds.minCol, cell.col),
      maxCol: Math.max(bounds.maxCol, cell.col),
      minRow: Math.min(bounds.minRow, cell.row),
      maxRow: Math.max(bounds.maxRow, cell.row),
    }),
    { minCol: Infinity, maxCol: -Infinity, minRow: Infinity, maxRow: -Infinity },
  );
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
  return piece.shape[piece.rotation % piece.shape.length]
    .map((cell) => ({ col: piece.x + cell.x, row: piece.y + cell.y }))
    .filter((cell) => cell.row >= 0);
}

function getBlockFormFactor(cells: RenderPoint[]): BlockFormFactor {
  const bounds = getBounds(cells);
  const width = bounds.maxCol - bounds.minCol + 1;
  const height = bounds.maxRow - bounds.minRow + 1;
  if (cells.length !== width * height) {
    return "other";
  }
  if (width === height) {
    return "square";
  }
  return width > height ? "wide" : "tall";
}

function pickBaseTexture(cell: Cell, cells: RenderPoint[]): TextureVariant | null {
  if (cell.category === "normal") {
    return { src: NORMAL_TEXTURES[cell.blockId % NORMAL_TEXTURES.length] };
  }

  const formFactor = getBlockFormFactor(cells);
  if (cell.category === "guard") {
    return formFactor === "square" ? { src: "/texture-pack/ddg_shield.png" } : null;
  }
  if (cell.category === "audit") {
    return formFactor === "square" ? { src: "/texture-pack/audit_module.png" } : null;
  }
  if (cell.category === "tech") {
    if (formFactor === "other") {
      return null;
    }
    const family = TECH_TEXTURES[cell.blockId % TECH_TEXTURES.length];
    return family[formFactor] ?? null;
  }
  return null;
}

function drawTextureCover(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation = 0,
) {
  const quarterTurn = Math.abs(rotation) % Math.PI > 0.01;
  const frameWidth = quarterTurn ? height : width;
  const frameHeight = quarterTurn ? width : height;
  const scale = Math.max(frameWidth / image.naturalWidth, frameHeight / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;

  ctx.translate(x + width / 2, y + height / 2);
  ctx.rotate(rotation);
  ctx.drawImage(image, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
}

function drawImageCoverInRect(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  rect: Rect,
  alpha = 1,
  alignX = 0.5,
  alignY = 0.5,
) {
  const scale = Math.max(rect.width / image.naturalWidth, rect.height / image.naturalHeight);
  const drawWidth = image.naturalWidth * scale;
  const drawHeight = image.naturalHeight * scale;
  const drawX = rect.x + (rect.width - drawWidth) * alignX;
  const drawY = rect.y + (rect.height - drawHeight) * alignY;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight);
  ctx.restore();
}

function drawBottomAnchoredLayer(ctx: CanvasRenderingContext2D, src: string, alpha = 1, rect?: Rect) {
  const image = getTexture(src);
  if (!image || !image.complete || image.naturalWidth === 0) {
    return false;
  }
  drawImageCoverInRect(
    ctx,
    image,
    rect ?? { x: 0, y: CANVAS_HEIGHT - 132, width: CANVAS_WIDTH, height: 132 },
    alpha,
    0.5,
    1,
  );
  return true;
}

function getPoleGeometry() {
  const poleCenterX = CANVAS_WIDTH * 0.5;
  const stackTop = 6;
  const stackBottom = 706;
  const repeatCount = 3;
  const sourceHeight = POLE_TOP.baseHeight + POLE_CABLE.baseHeight + POLE_CONTROL.baseHeight + POLE_BOTTOM.baseHeight + repeatCount * POLE_REPEAT.baseHeight;
  const availableHeight = stackBottom - stackTop;
  const verticalScale = availableHeight / sourceHeight;
  const poleWidth = 256 * verticalScale;
  const cellSize = 30;
  const centerGap = 58;
  const placements: PolePlacement[] = [];
  let currentY = stackTop;

  const stackSegments: PoleSegmentDefinition[] = [
    POLE_TOP,
    ...Array.from({ length: repeatCount }, () => POLE_REPEAT),
    POLE_CABLE,
    POLE_CONTROL,
    POLE_BOTTOM,
  ];

  for (const segment of stackSegments) {
    const height = segment.baseHeight * verticalScale;
    placements.push({
      src: segment.src,
      x: poleCenterX - poleWidth / 2,
      y: currentY,
      width: poleWidth,
      height,
      visibility: segment.visibility,
    });
    currentY += height;
  }

  return {
    poleCenterX,
    poleWidth,
    stackTop,
    stackBottom,
    cellSize,
    centerGap,
    gridTop: stackTop + 22,
    gridHeight: BOARD_ROWS * cellSize,
    placements,
  };
}

function getCellRect(col: number, row: number): Rect {
  const { poleCenterX, gridTop, cellSize, centerGap, poleWidth } = getPoleGeometry();
  const size = cellSize;
  let xCenter = poleCenterX;
  if (col < 2) {
    const bandIndex = 1 - col;
    xCenter = poleCenterX - (centerGap + bandIndex * size + size / 2);
  } else if (col >= 6) {
    const bandIndex = col - 6;
    xCenter = poleCenterX + (centerGap + bandIndex * size + size / 2);
  } else {
    const rearOffsets = [-poleWidth * 0.17, -poleWidth * 0.07, poleWidth * 0.07, poleWidth * 0.17];
    xCenter = poleCenterX + rearOffsets[col - 2];
  }
  return {
    x: xCenter - size / 2,
    y: gridTop + row * size,
    width: size,
    height: size,
  };
}

function buildBlockPath(cells: RenderPoint[]) {
  const path = new Path2D();
  for (const cell of cells) {
    const rect = getCellRect(cell.col, cell.row);
    path.rect(rect.x, rect.y, rect.width, rect.height);
  }
  return path;
}

function getBlockRectBounds(cells: RenderPoint[]) {
  return cells.reduce(
    (bounds, cell) => {
      const rect = getCellRect(cell.col, cell.row);
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
  const image = getTexture(texture.src);
  if (!image || !image.complete || image.naturalWidth === 0) {
    return;
  }
  ctx.save();
  ctx.clip(path);
  drawTextureCover(ctx, image, x, y, width, height, texture.rotation ?? 0);
  ctx.restore();
}

function drawAmbientBackdrop(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  const sky = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
  sky.addColorStop(0, "#adc9ff");
  sky.addColorStop(0.38, "#d7ecff");
  sky.addColorStop(0.7, "#b7d1a4");
  sky.addColorStop(1, "#537146");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const halo = ctx.createRadialGradient(CANVAS_WIDTH / 2, 136, 18, CANVAS_WIDTH / 2, 136, 112);
  halo.addColorStop(0, snapshot.channelState === "guarded" ? "rgba(119,223,255,0.5)" : snapshot.channelState === "partial" ? "rgba(255,210,133,0.36)" : "rgba(255,122,122,0.34)");
  halo.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(CANVAS_WIDTH / 2, 136, 112, 0, Math.PI * 2);
  ctx.fill();

  const facade = getTexture(SCENE_BACKGROUND_LAYER);
  if (facade && facade.complete && facade.naturalWidth > 0) {
    drawImageCoverInRect(ctx, facade, { x: -12, y: 18, width: CANVAS_WIDTH + 24, height: CANVAS_HEIGHT - 72 }, 0.97, 0.5, 0.86);
  }
}

function drawPoleStructure(ctx: CanvasRenderingContext2D) {
  const { placements, poleCenterX, stackTop, stackBottom, poleWidth } = getPoleGeometry();

  ctx.save();
  const trench = ctx.createLinearGradient(0, stackTop, 0, stackBottom);
  trench.addColorStop(0, "rgba(41, 51, 39, 0.18)");
  trench.addColorStop(1, "rgba(31, 24, 18, 0.3)");
  ctx.fillStyle = trench;
  ctx.fillRect(poleCenterX - poleWidth * 0.34, stackTop - 8, poleWidth * 0.68, stackBottom - stackTop + 16);

  ctx.strokeStyle = "rgba(18, 26, 23, 0.24)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(poleCenterX, stackTop);
  ctx.lineTo(poleCenterX, stackBottom);
  ctx.stroke();

  for (const placement of placements) {
    const image = getTexture(placement.src);
    if (!image || !image.complete || image.naturalWidth === 0) {
      continue;
    }
    ctx.drawImage(image, placement.x, placement.y, placement.width, placement.height);
  }
  ctx.restore();
}

function progressToY(progress: number) {
  const { gridTop, gridHeight } = getPoleGeometry();
  return gridTop + (progress / BOARD_ROWS) * gridHeight;
}

function drawSignalPackets(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  const { poleCenterX, placements, gridTop, gridHeight } = getPoleGeometry();

  ctx.save();
  const coreGlow = ctx.createLinearGradient(0, gridTop, 0, gridTop + gridHeight);
  coreGlow.addColorStop(0, "rgba(255,255,255,0)");
  coreGlow.addColorStop(0.2, snapshot.channelState === "guarded" ? "rgba(104, 228, 255, 0.22)" : snapshot.channelState === "partial" ? "rgba(255, 210, 120, 0.18)" : "rgba(255, 92, 92, 0.2)");
  coreGlow.addColorStop(1, "rgba(255,255,255,0)");
  ctx.strokeStyle = coreGlow;
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(poleCenterX, gridTop + gridHeight + 18);
  ctx.lineTo(poleCenterX, gridTop - 12);
  ctx.stroke();

  for (const placement of placements) {
    ctx.save();
    ctx.globalAlpha = placement.visibility * 0.15;
    ctx.fillStyle = "rgba(148, 220, 255, 0.9)";
    ctx.fillRect(placement.x + placement.width * 0.47, placement.y, placement.width * 0.06, placement.height);
    ctx.restore();
  }

  snapshot.signalPackets.forEach((packet) => {
    drawPacket(ctx, packet, snapshot, poleCenterX);
  });

  ctx.restore();
}

function drawPacket(ctx: CanvasRenderingContext2D, packet: SignalPacket, snapshot: GameSnapshot, poleCenterX: number) {
  const y = progressToY(packet.progress);
  const x = poleCenterX + packet.laneOffset * 14;
  const tail = packet.state === "dropping" ? 10 + packet.age * 0.06 : 18 + packet.brightness * 10;
  const baseColor = packet.corrupted > 0.35 || packet.state === "dropping" ? [255, 96, 96] : snapshot.channelState === "guarded" ? [130, 236, 255] : snapshot.channelState === "partial" ? [255, 211, 128] : [255, 130, 130];

  ctx.save();
  ctx.globalAlpha = packet.state === "dropping" ? Math.max(0, packet.brightness * 0.9) : packet.brightness;
  const gradient = ctx.createLinearGradient(x, y, x, y + tail);
  gradient.addColorStop(0, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.98)`);
  gradient.addColorStop(0.3, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.35)`);
  gradient.addColorStop(1, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0)`);
  ctx.strokeStyle = gradient;
  ctx.lineWidth = packet.state === "dropping" ? 2.4 : 2;
  ctx.beginPath();
  ctx.moveTo(x, y - 3);
  ctx.lineTo(x, y + tail);
  ctx.stroke();

  ctx.shadowBlur = 14;
  ctx.shadowColor = `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 0.52)`;
  ctx.fillStyle = `rgba(255,255,255,${packet.state === "dropping" ? 0.72 : 0.94})`;
  ctx.beginPath();
  ctx.ellipse(x, y, packet.state === "dropping" ? 3.8 : 3.2, packet.state === "dropping" ? 6.4 : 5.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawAttackPulses(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  const { poleCenterX, gridTop, gridHeight } = getPoleGeometry();
  for (const pulse of snapshot.attackPulses) {
    const y = gridTop + ((pulse.row + 0.5) / BOARD_ROWS) * gridHeight;
    const progress = pulse.age / 420;
    const startX = pulse.side === "left" ? -16 : CANVAS_WIDTH + 16;
    const endX = pulse.side === "left" ? poleCenterX - 16 : poleCenterX + 16;
    const controlX = pulse.side === "left" ? 92 + progress * 48 : CANVAS_WIDTH - 92 - progress * 48;
    const gradient =
      pulse.side === "left"
        ? ctx.createLinearGradient(startX, y, endX, y)
        : ctx.createLinearGradient(endX, y, startX, y);
    gradient.addColorStop(0, "rgba(255,95,95,0)");
    gradient.addColorStop(0.6, "rgba(255,115,82,0.58)");
    gradient.addColorStop(1, "rgba(255,115,82,0.96)");
    ctx.strokeStyle = gradient;
    ctx.lineWidth = Math.max(1.2, 4 - progress * 2.6);
    ctx.beginPath();
    ctx.moveTo(startX, y);
    ctx.quadraticCurveTo(controlX, y - 10 + progress * 8, endX, y);
    ctx.stroke();
  }
}

function drawBlockGroup(ctx: CanvasRenderingContext2D, cell: Cell, cells: RenderPoint[], active = false) {
  if (cells.length === 0) {
    return;
  }

  const occupied = new Set(cells.map((item) => `${item.col}:${item.row}`));
  const path = buildBlockPath(cells);
  const color = BLOCK_COLORS[cell.category];
  const bounds = getBlockRectBounds(cells);
  const baseTexture = pickBaseTexture(cell, cells);
  const damageTexture = cell.durability < cell.maxDurability ? { src: DAMAGE_TEXTURES[cell.durability <= Math.max(1, Math.floor(cell.maxDurability * 0.45)) ? 1 : 0] } : null;
  const { poleCenterX, poleWidth } = getPoleGeometry();

  ctx.save();
  for (const point of cells) {
    const rect = getCellRect(point.col, point.row);
    if (point.col >= 2 && point.col <= 5) {
      continue;
    }
    const side = point.col < 2 ? 1 : -1;
    ctx.strokeStyle = cell.category === "guard" ? "rgba(116,212,255,0.34)" : "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.moveTo(side > 0 ? rect.x + rect.width : rect.x, rect.y + rect.height / 2);
    ctx.lineTo(poleCenterX + side * (poleWidth * 0.5 + 4), rect.y + rect.height / 2);
    ctx.stroke();
  }

  ctx.shadowBlur = active ? 18 : 10;
  ctx.shadowColor = active ? "rgba(255,255,255,0.36)" : cell.category === "guard" || cell.audited ? "rgba(26, 144, 255, 0.4)" : "rgba(18, 22, 30, 0.35)";
  ctx.shadowOffsetY = 6;
  ctx.fillStyle = "rgba(15, 18, 24, 0.36)";
  ctx.fill(path);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = color;
  ctx.fill(path);

  if (baseTexture) {
    drawBlockTexture(ctx, baseTexture, path, bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  }

  ctx.clip(path);
  const overlay = ctx.createLinearGradient(bounds.minX, bounds.minY, bounds.minX, bounds.maxY);
  overlay.addColorStop(0, "rgba(255,255,255,0.22)");
  overlay.addColorStop(0.28, "rgba(255,255,255,0.06)");
  overlay.addColorStop(1, "rgba(0,0,0,0.12)");
  ctx.fillStyle = overlay;
  ctx.fillRect(bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);

  if (damageTexture) {
    drawBlockTexture(ctx, damageTexture, path, bounds.minX, bounds.minY, bounds.maxX - bounds.minX, bounds.maxY - bounds.minY);
  }
  ctx.restore();

  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = cell.audited ? "#eefaff" : "rgba(255,255,255,0.24)";
  ctx.lineWidth = 1.4;
  for (const point of cells) {
    const rect = getCellRect(point.col, point.row);
    if (!occupied.has(`${point.col}:${point.row - 1}`)) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 4, rect.y + 4);
      ctx.lineTo(rect.x + rect.width - 4, rect.y + 4);
      ctx.stroke();
    }
    if (!occupied.has(`${point.col + 1}:${point.row}`)) {
      ctx.beginPath();
      ctx.moveTo(rect.x + rect.width - 4, rect.y + 4);
      ctx.lineTo(rect.x + rect.width - 4, rect.y + rect.height - 4);
      ctx.stroke();
    }
    if (!occupied.has(`${point.col}:${point.row + 1}`)) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 4, rect.y + rect.height - 4);
      ctx.lineTo(rect.x + rect.width - 4, rect.y + rect.height - 4);
      ctx.stroke();
    }
    if (!occupied.has(`${point.col - 1}:${point.row}`)) {
      ctx.beginPath();
      ctx.moveTo(rect.x + 4, rect.y + 4);
      ctx.lineTo(rect.x + 4, rect.y + rect.height - 4);
      ctx.stroke();
    }
  }

  if (cell.fortified > 0 || cell.audited) {
    ctx.strokeStyle = "rgba(116, 212, 255, 0.94)";
    ctx.lineWidth = 1.5;
    ctx.stroke(path);
  }

  if (cell.flash > 0) {
    ctx.globalAlpha = cell.flash * 0.24;
    ctx.fillStyle = "#ffffff";
    ctx.fill(path);
  }
  ctx.restore();
}

function drawAuditBursts(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  snapshot.auditBursts.forEach((burst) => {
    const rect = getCellRect(Math.round(burst.x), Math.round(burst.y));
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const progress = burst.age / 720;
    ctx.save();
    ctx.globalAlpha = 1 - progress;
    ctx.strokeStyle = "rgba(116, 212, 255, 0.85)";
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(centerX, centerY, 12 + progress * 54, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

export function renderSnapshot(ctx: CanvasRenderingContext2D, snapshot: GameSnapshot) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawAmbientBackdrop(ctx, snapshot);
  drawSignalPackets(ctx, snapshot);

  for (const block of collectBlocks(snapshot)) {
    drawBlockGroup(ctx, block.cell, block.cells);
  }

  if (snapshot.activePiece) {
    drawBlockGroup(
      ctx,
      {
        blockId: snapshot.activePiece.id,
        category: snapshot.activePiece.category,
        baseDurability: 1,
        durability: 1,
        maxDurability: 1,
        fortified: snapshot.activePiece.category === "guard" ? 2 : snapshot.activePiece.category === "audit" ? 1 : 0,
        audited: snapshot.activePiece.category === "guard" || snapshot.activePiece.category === "audit",
        flash: 0,
      },
      getPieceCells(snapshot.activePiece),
      true,
    );
  }

  drawPoleStructure(ctx);
  drawAttackPulses(ctx, snapshot);
  drawAuditBursts(ctx, snapshot);
  drawBottomAnchoredLayer(ctx, SCENE_FOREGROUND_LAYER, 0.99, {
    x: 0,
    y: CANVAS_HEIGHT - 148,
    width: CANVAS_WIDTH,
    height: 148,
  });

}

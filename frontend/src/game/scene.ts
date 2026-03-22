import { BOARD_COLS, BOARD_LAYER_SCALE, BOARD_ROWS, HIDDEN_TOP_ROWS, VISIBLE_BOARD_ROWS } from "./board.ts";

export interface SceneLayout {
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  gridTop: number;
  groundLineY: number;
  foregroundTopY: number;
  poleAxisX: number;
  poleWidth: number;
  poleTop: number;
  poleBottom: number;
  boardTop: number;
  boardBottom: number;
  buildBaseY: number;
  boardLeft: number;
  boardWidth: number;
  boardHeight: number;
  gridHeight: number;
  cellSize: number;
  cellGap: number;
  rowGap: number;
  laneCenters: number[];
  rowTops: number[];
  rowCenters: number[];
  curbHeight: number;
}

interface SceneAnchors {
  topSafeRatio: number;
  bottomSafeRatio: number;
  groundLineFromBottomRatio: number;
  poleBuriedDepthRatio: number;
  buildBaseBelowPoleRatio: number;
  boardHeightRatio: number;
}

export const SCENE_ASSETS = {
  background: "/scene-layers/background_facade.png",
  foreground: "/scene-layers/foreground_curb.png",
  pole: { src: "/pole-pack/pole.png", width: 246, height: 1526 },
  poleSecurityEffect: { src: "/pole-pack/pole-security-effect.png", width: 246, height: 1526 },
  poleSignal: { src: "/pole-pack/pole-signal-spritesheet.png", width: 5904, height: 1526 },
} as const;

const SCENE_ANCHORS: SceneAnchors = {
  topSafeRatio: 0.13,
  bottomSafeRatio: 0.18,
  groundLineFromBottomRatio: 0.78,
  poleBuriedDepthRatio: 0.28,
  buildBaseBelowPoleRatio: -0.9,
  boardHeightRatio: 0.58,
};

let cachedLayout: SceneLayout | null = null;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createBoardAxis(layoutWidth: number, poleAxisX: number, cellPitch: number, edgeBleed: number) {
  const centeredOffsets = Array.from({ length: BOARD_COLS }, (_, index) => index - (BOARD_COLS - 1) / 2);
  const rawCenters = centeredOffsets.map((offset) => poleAxisX + offset * cellPitch);
  const overflowLeft = Math.max(0, -edgeBleed - (rawCenters[0] - cellPitch / 2));
  const overflowRight = Math.max(0, rawCenters[rawCenters.length - 1] + cellPitch / 2 - (layoutWidth + edgeBleed));
  const correction = overflowLeft > 0 ? overflowLeft : overflowRight > 0 ? -overflowRight : 0;
  return rawCenters.map((center) => center + correction);
}

export function getSceneLayout(width: number, height: number): SceneLayout {
  if (cachedLayout && cachedLayout.width === width && cachedLayout.height === height) {
    return cachedLayout;
  }

  const safeTop = clamp(height * SCENE_ANCHORS.topSafeRatio, 84, 134);
  const safeBottom = clamp(height * SCENE_ANCHORS.bottomSafeRatio, 120, 182);
  const curbHeight = clamp(height * 0.12, 84, 132);
  const groundLineY = height - curbHeight * SCENE_ANCHORS.groundLineFromBottomRatio;
  const poleBuriedDepth = curbHeight * SCENE_ANCHORS.poleBuriedDepthRatio;
  const buildBaseOffset = curbHeight * SCENE_ANCHORS.buildBaseBelowPoleRatio;
  const poleAxisX = width / 2;
  const poleWidth = clamp(width * 0.33, 126, 154);
  const poleHeight = poleWidth * (SCENE_ASSETS.pole.height / SCENE_ASSETS.pole.width);
  const poleBottom = groundLineY + poleBuriedDepth;
  const poleTop = poleBottom - poleHeight;
  const boardHeightTarget = clamp(height * SCENE_ANCHORS.boardHeightRatio, height * 0.46, height * 0.64);
  const buildBaseY = poleBottom + buildBaseOffset;
  const boardBottom = buildBaseY;
  const boardTop = Math.max(
    poleTop + poleHeight * 0.18,
    boardBottom - boardHeightTarget,
  );
  const boardHeight = boardBottom - boardTop;
  const baseRowGap = clamp(boardHeight * 0.008, 3, 7);
  const cellSizeByHeight = (boardHeight - baseRowGap * (VISIBLE_BOARD_ROWS - 1)) / VISIBLE_BOARD_ROWS;
  const edgeBleed = clamp(width * 0.08, 18, 34);
  const maxBoardWidth = width + edgeBleed * 2;
  const baseCellGap = clamp(cellSizeByHeight * 0.12, 4, 7);
  const cellSizeByWidth = (maxBoardWidth - baseCellGap * (BOARD_COLS - 1)) / BOARD_COLS;
  const baseCellSize = Math.min(cellSizeByHeight, cellSizeByWidth);
  const cellSize = Math.max(1, Math.floor(baseCellSize * BOARD_LAYER_SCALE));
  const verticalGap = Math.max(1, Math.round(baseRowGap * BOARD_LAYER_SCALE));
  const cellGap = Math.max(1, Math.round(baseCellGap * BOARD_LAYER_SCALE));
  const cellPitch = cellSize + cellGap;
  const laneCenters = createBoardAxis(width, poleAxisX, cellPitch, edgeBleed);
  const boardWidth = cellSize * BOARD_COLS + cellGap * (BOARD_COLS - 1);
  const boardLeft = laneCenters[0] - cellSize / 2;
  const gridTop = boardTop - HIDDEN_TOP_ROWS * (cellSize + verticalGap);
  const rowTops = Array.from({ length: BOARD_ROWS }, (_, row) => gridTop + row * (cellSize + verticalGap));
  const rowCenters = rowTops.map((top) => top + cellSize / 2);
  const gridHeight = rowTops[BOARD_ROWS - 1] + cellSize - gridTop;
  const layout = {
    width,
    height,
    safeTop,
    safeBottom,
    gridTop,
    groundLineY,
    foregroundTopY: groundLineY - curbHeight * (1 - SCENE_ANCHORS.groundLineFromBottomRatio),
    poleAxisX,
    poleWidth,
    poleTop,
    poleBottom,
    boardTop,
    boardBottom,
    buildBaseY,
    boardLeft,
    boardWidth,
    boardHeight: rowTops[BOARD_ROWS - 1] + cellSize - boardTop,
    gridHeight,
    cellSize,
    cellGap,
    rowGap: verticalGap,
    laneCenters,
    rowTops,
    rowCenters,
    curbHeight,
  };

  cachedLayout = layout;
  return layout;
}

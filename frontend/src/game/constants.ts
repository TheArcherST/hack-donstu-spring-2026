import type { BlockCategory, Point } from "./types";

export const BOARD_COLS = 8;
export const BOARD_ROWS = 16;
export const CANVAS_WIDTH = 400;
export const CANVAS_HEIGHT = 760;
export const FIELD_X = 56;
export const FIELD_Y = 128;
export const CELL_SIZE = 36;
export const CABLE_SPLIT_COL = BOARD_COLS / 2;
export const MATCH_DURATION_SECONDS = 90;
export const WIN_PROTECTION_THRESHOLD = 62;

export const BLOCK_DURABILITY: Record<BlockCategory, number> = {
  normal: 3,
  tech: 4,
  guard: 6,
  audit: 5,
};

export const BLOCK_SCORE: Record<BlockCategory, number> = {
  normal: 26,
  tech: 42,
  guard: 72,
  audit: 110,
};

export const BLOCK_COLORS: Record<BlockCategory, string> = {
  normal: "#9aabc1",
  tech: "#4ecdc4",
  guard: "#0077ff",
  audit: "#74d4ff",
};

export const PIECE_SHAPES: Point[][][] = [
  [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
  ],
  [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
  ],
  [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
    ],
  ],
  [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
      { x: 0, y: 3 },
    ],
  ],
  [
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
  [
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
      { x: 0, y: 2 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
    [
      { x: 1, y: 0 },
      { x: 1, y: 1 },
      { x: 0, y: 2 },
      { x: 1, y: 2 },
    ],
  ],
];

export const AUDIT_SHAPE: Point[][] = [
  [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 0, y: 1 },
    { x: 1, y: 1 },
  ],
];

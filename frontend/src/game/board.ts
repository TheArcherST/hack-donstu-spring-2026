interface BoardPoint {
  x: number;
  y: number;
}

export const BOARD_COLS = 12;
export const BOARD_ROWS = 24;
export const VISIBLE_BOARD_ROWS = 16;
export const HIDDEN_TOP_ROWS = BOARD_ROWS - VISIBLE_BOARD_ROWS;
export const BOARD_LAYER_SCALE = 1.2;
export const BOARD_SPAWN_ROW = 0;

export const DEFENSE_CORE_START_COL = 2;
export const DEFENSE_LEFT_COLS = 2;
export const DEFENSE_REAR_COLS = 4;
export const DEFENSE_RIGHT_COLS = 2;

export const DEFENSE_LEFT_START_COL = DEFENSE_CORE_START_COL;
export const DEFENSE_REAR_START_COL = DEFENSE_LEFT_START_COL + DEFENSE_LEFT_COLS;
export const DEFENSE_RIGHT_START_COL = DEFENSE_REAR_START_COL + DEFENSE_REAR_COLS;
export const DEFENSE_RIGHT_END_COL = DEFENSE_RIGHT_START_COL + DEFENSE_RIGHT_COLS;

export function getPieceSpawnRow(points: BoardPoint[]) {
  const minY = points.reduce((currentMin, point) => Math.min(currentMin, point.y), Infinity);
  return BOARD_SPAWN_ROW - minY;
}

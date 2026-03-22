import { HIDDEN_TOP_ROWS } from "./board.ts";
import type { GameSnapshot } from "./types.ts";
import type { SceneLayout } from "./scene.ts";

const CAMERA_REST_TOP_ROW = HIDDEN_TOP_ROWS + 4;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function getTopSettledRow(snapshot: GameSnapshot) {
  if (typeof snapshot.topSettledRow === "number") {
    return snapshot.topSettledRow;
  }

  let topRow = snapshot.grid.length;

  snapshot.grid.forEach((row, rowIndex) => {
    if (row.some(Boolean)) {
      topRow = Math.min(topRow, rowIndex);
    }
  });

  return topRow;
}

export function getCameraLiftRows(topRow: number, totalRows: number) {
  if (topRow >= totalRows) {
    return 0;
  }

  const desiredTopRow = clamp(CAMERA_REST_TOP_ROW, 0, totalRows - 1);
  return clamp(desiredTopRow - topRow, 0, HIDDEN_TOP_ROWS);
}

export function getCameraLiftTarget(layout: SceneLayout, snapshot: GameSnapshot) {
  const topRow = getTopSettledRow(snapshot);
  if (topRow === snapshot.grid.length) {
    return 0;
  }

  const liftRows = getCameraLiftRows(topRow, snapshot.grid.length);
  return liftRows * (layout.cellSize + layout.rowGap);
}

export function advanceCameraLift(current: number, target: number, deltaMs: number) {
  if (Math.abs(target - current) < 0.5) {
    return target;
  }

  const timeConstant = target > current ? 140 : 220;
  const alpha = 1 - Math.exp(-Math.max(0, deltaMs) / timeConstant);
  return current + (target - current) * alpha;
}

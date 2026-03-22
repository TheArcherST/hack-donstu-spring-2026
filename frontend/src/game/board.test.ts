import test from "node:test";
import assert from "node:assert/strict";

import { BOARD_COLS, BOARD_LAYER_SCALE, BOARD_ROWS, BOARD_SPAWN_ROW, HIDDEN_TOP_ROWS, getPieceSpawnRow } from "./board.ts";

test("spawn rows keep new pieces fully inside the hidden top buffer", () => {
  const tallPiece = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
    { x: 0, y: 3 },
  ];
  const widePiece = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 2, y: 0 },
  ];

  const tallSpawnRow = getPieceSpawnRow(tallPiece);
  const wideSpawnRow = getPieceSpawnRow(widePiece);

  assert.equal(tallSpawnRow, BOARD_SPAWN_ROW);
  assert.equal(wideSpawnRow, BOARD_SPAWN_ROW);
  assert.equal(BOARD_SPAWN_ROW, 0);
});

test("expanded board keeps side build buffers while preserving a centered defense core", () => {
  assert.equal(BOARD_COLS, 12);
  assert.equal(BOARD_ROWS, 24);
  assert.equal(HIDDEN_TOP_ROWS, 8);
  assert.equal(BOARD_LAYER_SCALE, 1.2);
});

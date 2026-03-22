import assert from "node:assert/strict";
import test from "node:test";

import { BOARD_COLS, BOARD_ROWS } from "./board.ts";
import { findSpawnPlacement, getPreferredSpawnY } from "./engine.ts";
import { createEmptyGrid } from "./simulation.ts";
import type { Piece } from "./types.ts";

test("spawn placement falls back above the top row before failing", () => {
  const grid = createEmptyGrid();
  for (let x = 0; x < BOARD_COLS; x += 1) {
    grid[0][x] = {
      blockId: x + 1,
      category: "normal",
      baseDurability: 1,
      durability: 1,
      maxDurability: 1,
      fortified: 0,
      audited: false,
      flash: 0,
      surfaceStyle: "metal",
      textureSrc: null,
      textureRotation: 0,
    };
  }

  const piece: Piece = {
    id: 99,
    category: "normal",
    shape: [[{ x: 0, y: 0 }]],
    rotation: 0,
    x: 0,
    y: 0,
    surfaceStyle: "metal",
    textureSrc: null,
    textureRotation: 0,
  };

  const spawnColumns = Array.from({ length: BOARD_COLS }, (_, index) => index);
  const placement = findSpawnPlacement(grid, piece, [0, -1, -2], spawnColumns);

  assert.deepEqual(placement, { x: 0, y: -1 });
});

test("preferred spawn row moves upward as the camera lift grows", () => {
  const verticalPiece = [
    { x: 0, y: 0 },
    { x: 0, y: 1 },
    { x: 0, y: 2 },
  ];

  assert.equal(getPreferredSpawnY(BOARD_ROWS, verticalPiece), 7);
  assert.equal(getPreferredSpawnY(8, verticalPiece), 3);
  assert.equal(getPreferredSpawnY(0, verticalPiece), -1);
});

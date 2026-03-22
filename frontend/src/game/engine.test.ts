import assert from "node:assert/strict";
import test from "node:test";

import { BOARD_COLS, BOARD_ROWS } from "./board.ts";
import { applyAttackImpact, findSpawnPlacement, getPreferredSpawnY } from "./engine.ts";
import { buildCableStressFromHitDebuffs, createEmptyGrid, createSimulationState, withMetrics } from "./simulation.ts";
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

test("container hits stay block-scoped and do not degrade availability", () => {
  const state = createSimulationState();
  state.grid[10][0] = {
    blockId: 1,
    category: "guard",
    baseDurability: 4,
    durability: 4,
    maxDurability: 4,
    fortified: 2,
    audited: true,
    flash: 0,
    surfaceStyle: "metal",
    textureSrc: null,
    textureRotation: 0,
  };

  state.cableStress = Array.from({ length: BOARD_ROWS }, () => 0);
  const before = withMetrics(state);
  const result = applyAttackImpact(state, 10, "left");
  const after = withMetrics(state);

  assert.equal(result.impact, "block");
  assert.equal(result.targetCol, 0);
  assert.equal(state.cableHitDebuffs.length, 0);
  assert.equal(state.systemIntegrity, 42);
  assert.equal(state.grid[10][0]?.durability, 4);
  assert.equal(state.grid[10][0]?.fortified, 2);
  assert.equal(after.linkQuality, before.linkQuality);
  assert.equal(after.latencyMs, before.latencyMs);
  assert.equal(after.cableSegments[10]?.dropChance, before.cableSegments[10]?.dropChance);
});

test("only misses add cable-hit debuffs and reduce availability", () => {
  const state = createSimulationState();
  state.cableStress = Array.from({ length: BOARD_ROWS }, () => 0);
  const before = withMetrics(state);
  const result = applyAttackImpact(state, 10, "left");

  assert.equal(result.impact, "cable");
  assert.equal(state.cableHitDebuffs.length, 1);
  assert.equal(state.systemIntegrity, 35.4);
  state.cableStress = buildCableStressFromHitDebuffs(state.cableHitDebuffs);
  const after = withMetrics(state);
  assert.ok(after.linkQuality < before.linkQuality);
  assert.ok(after.latencyMs > before.latencyMs);
});

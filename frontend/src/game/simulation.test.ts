import test from "node:test";
import assert from "node:assert/strict";

import {
  applyStructureGravityStep,
  ageCableHitDebuffs,
  buildCableStressFromHitDebuffs,
  createEmptyGrid,
  createSimulationState,
  getCableHitDebuffStrength,
  withMetrics,
} from "./simulation.ts";
import type { Cell } from "./types.ts";

function createCell(blockId: number): Cell {
  return {
    blockId,
    category: "normal",
    baseDurability: 3,
    durability: 3,
    maxDurability: 3,
    fortified: 0,
    audited: false,
    flash: 0,
    surfaceStyle: "metal",
    textureSrc: null,
    textureRotation: 0,
  };
}

test("structure gravity drops unsupported blocks one row per tick, including stacked groups", () => {
  const grid = createEmptyGrid();

  grid[20][4] = createCell(1);
  grid[20][5] = createCell(1);
  grid[21][4] = createCell(1);
  grid[21][5] = createCell(1);

  grid[18][4] = createCell(2);
  grid[18][5] = createCell(2);
  grid[19][4] = createCell(2);
  grid[19][5] = createCell(2);

  const result = applyStructureGravityStep(grid);

  assert.equal(result.movedBlocks, 2);
  assert.equal(result.collapsedBlocks, 0);
  assert.equal(grid[19][4]?.blockId, 2);
  assert.equal(grid[19][5]?.blockId, 2);
  assert.equal(grid[20][4]?.blockId, 2);
  assert.equal(grid[20][5]?.blockId, 2);
  assert.equal(grid[21][4]?.blockId, 1);
  assert.equal(grid[21][5]?.blockId, 1);
  assert.equal(grid[22][4]?.blockId, 1);
  assert.equal(grid[22][5]?.blockId, 1);
});

test("partially supported blocks tilt and self-destruct after a short collapse window", () => {
  const grid = createEmptyGrid();

  grid[22][4] = createCell(1);
  grid[22][5] = createCell(1);
  grid[23][4] = createCell(2);

  const firstStep = applyStructureGravityStep(grid, new Set(), 260);
  assert.equal(firstStep.movedBlocks, 0);
  assert.equal(firstStep.collapsedBlocks, 0);
  assert.equal(grid[22][4]?.tiltDirection, 1);
  assert.ok((grid[22][4]?.collapseProgress ?? 0) > 0);

  let collapsed = false;
  for (let index = 0; index < 12; index += 1) {
    const step = applyStructureGravityStep(grid, new Set(), 260);
    if (step.collapsedBlocks > 0) {
      collapsed = true;
      break;
    }
  }

  assert.equal(collapsed, true);
  assert.equal(grid[22][4], null);
  assert.equal(grid[22][5], null);
});

test("cable hit debuff strictly weakens over time until it expires", () => {
  assert.equal(getCableHitDebuffStrength(0), 1);
  assert.ok(getCableHitDebuffStrength(1_000) < getCableHitDebuffStrength(0));
  assert.ok(getCableHitDebuffStrength(3_000) < getCableHitDebuffStrength(2_000));
  assert.ok(getCableHitDebuffStrength(6_000) < getCableHitDebuffStrength(3_000));
  assert.equal(getCableHitDebuffStrength(15_000), 0);
});

test("expected protection remains structural while live protection dips from cable hits", () => {
  const state = createSimulationState();

  state.grid[10][2] = createCell(1);
  state.grid[10][3] = createCell(1);
  state.grid[10][4] = createCell(2);
  state.grid[10][5] = createCell(2);
  state.grid[10][6] = createCell(2);
  state.grid[10][7] = createCell(2);
  state.grid[10][8] = createCell(3);
  state.grid[10][9] = createCell(3);

  state.cableStress = buildCableStressFromHitDebuffs([{ row: 10, ageMs: 0 }]);
  const metrics = withMetrics(state);
  const hitSegment = metrics.cableSegments[10];
  const adjacentSegment = metrics.cableSegments[9];

  assert.ok(hitSegment.expectedProtection > 0.7);
  assert.ok(hitSegment.protection < hitSegment.expectedProtection);
  assert.ok(adjacentSegment.stress > 0);
});

test("structural protection no longer changes transport metrics without cable hits", () => {
  const emptyState = createSimulationState();
  emptyState.cableStress = buildCableStressFromHitDebuffs([]);
  const emptyMetrics = withMetrics(emptyState);

  const protectedState = createSimulationState();
  protectedState.grid[10][2] = createCell(1);
  protectedState.grid[10][3] = createCell(1);
  protectedState.grid[10][4] = createCell(2);
  protectedState.grid[10][5] = createCell(2);
  protectedState.grid[10][6] = createCell(2);
  protectedState.grid[10][7] = createCell(2);
  protectedState.grid[10][8] = createCell(3);
  protectedState.grid[10][9] = createCell(3);
  protectedState.cableStress = buildCableStressFromHitDebuffs([]);
  const protectedMetrics = withMetrics(protectedState);

  assert.notEqual(protectedMetrics.cableSegments[10].expectedProtection, emptyMetrics.cableSegments[10].expectedProtection);
  assert.equal(protectedMetrics.cableSegments[10].signalSpeed, emptyMetrics.cableSegments[10].signalSpeed);
  assert.equal(protectedMetrics.cableSegments[10].dropChance, emptyMetrics.cableSegments[10].dropChance);
  assert.equal(protectedMetrics.linkQuality, emptyMetrics.linkQuality);
  assert.equal(protectedMetrics.latencyMs, emptyMetrics.latencyMs);
});

test("older cable-hit debuffs monotonically restore packet travel metrics", () => {
  const state = createSimulationState();

  state.grid[10][2] = createCell(1);
  state.grid[10][3] = createCell(1);
  state.grid[10][4] = createCell(2);
  state.grid[10][5] = createCell(2);
  state.grid[10][6] = createCell(2);
  state.grid[10][7] = createCell(2);
  state.grid[10][8] = createCell(3);
  state.grid[10][9] = createCell(3);

  state.cableStress = buildCableStressFromHitDebuffs([]);
  const baselineSegment = withMetrics(state).cableSegments[10];

  const [agedDebuff] = ageCableHitDebuffs([{ row: 10, ageMs: 0 }], 1_000);
  state.cableStress = buildCableStressFromHitDebuffs([agedDebuff]);
  const newerHitSegment = withMetrics(state).cableSegments[10];

  const [olderDebuff] = ageCableHitDebuffs([agedDebuff], 1_000);
  state.cableStress = buildCableStressFromHitDebuffs([olderDebuff]);
  const olderHitSegment = withMetrics(state).cableSegments[10];

  assert.equal(baselineSegment.stress, 0);
  assert.ok(newerHitSegment.stress > olderHitSegment.stress);
  assert.ok(newerHitSegment.signalSpeed < olderHitSegment.signalSpeed);
  assert.ok(newerHitSegment.dropChance > olderHitSegment.dropChance);
  assert.ok(olderHitSegment.signalSpeed < baselineSegment.signalSpeed);
  assert.ok(olderHitSegment.dropChance > baselineSegment.dropChance);
});

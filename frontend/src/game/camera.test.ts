import assert from "node:assert/strict";
import test from "node:test";

import { advanceCameraLift, getCameraLiftRows, getCameraLiftTarget } from "./camera.ts";
import { BOARD_COLS, BOARD_ROWS } from "./board.ts";
import type { SceneLayout } from "./scene.ts";
import type { GameSnapshot } from "./types.ts";

function createSnapshot(filledRows: number[]): GameSnapshot {
  const grid = Array.from({ length: BOARD_ROWS }, (_, rowIndex) =>
    Array.from({ length: BOARD_COLS }, (_, colIndex) =>
      filledRows.includes(rowIndex) && colIndex === Math.floor(BOARD_COLS / 2)
        ? {
            blockId: rowIndex + 1,
            category: "normal" as const,
            baseDurability: 1,
            durability: 1,
            maxDurability: 1,
            fortified: 0,
            audited: false,
            flash: 0,
            surfaceStyle: "metal" as const,
            textureSrc: null,
            textureRotation: 0,
          }
        : null,
    ),
  );

  return {
    grid,
    activePiece: null,
    nextPiece: {
      id: 0,
      category: "normal",
      shape: [[{ x: 0, y: 0 }]],
      rotation: 0,
      x: 0,
      y: 0,
      surfaceStyle: "metal",
      textureSrc: null,
      textureRotation: 0,
    },
    cableSegments: [],
    score: 0,
    timeLeftSeconds: 0,
    protectionLevel: 0,
    systemIntegrity: 0,
    attackIntensity: 0,
    destroyedSegments: 0,
    preservedSegments: 0,
    routeCompleted: false,
    status: "running",
    failureReason: null,
    channelState: "overloaded",
    attackProjectiles: [],
    damageLabels: [],
    auditBursts: [],
    signalPackets: [],
    linkQuality: 0,
    packetLoss: 0,
    throughput: 0,
    latencyMs: 0,
    deliveredPackets: 0,
    droppedPackets: 0,
    recentPacketLoss: 0,
    stableHoldSeconds: 0,
    stableTargetSeconds: 0,
    showHints: false,
    elapsedSeconds: 0,
  };
}

function createLayout(): SceneLayout {
  return {
    width: 390,
    height: 844,
    safeTop: 96,
    safeBottom: 140,
    gridTop: 140,
    groundLineY: 760,
    foregroundTopY: 742,
    poleAxisX: 195,
    poleWidth: 140,
    poleTop: 120,
    poleBottom: 820,
    boardTop: 280,
    boardBottom: 780,
    buildBaseY: 780,
    boardLeft: 36,
    boardWidth: 318,
    boardHeight: 500,
    gridHeight: 640,
    cellSize: 28,
    cellGap: 4,
    rowGap: 4,
    laneCenters: Array.from({ length: BOARD_COLS }, (_, index) => 50 + index * 28),
    rowTops: Array.from({ length: BOARD_ROWS }, (_, index) => 140 + index * 32),
    rowCenters: Array.from({ length: BOARD_ROWS }, (_, index) => 154 + index * 32),
    curbHeight: 102,
  };
}

test("camera stays grounded while the structure is low", () => {
  const layout = createLayout();
  const snapshot = createSnapshot([16, 17, 18, 19]);

  assert.equal(getCameraLiftTarget(layout, snapshot), 0);
});

test("camera lifts when the settled tower reaches the upper rows", () => {
  const layout = createLayout();
  const snapshot = createSnapshot([0, 1, 2, 3, 4, 5]);

  assert.ok(getCameraLiftTarget(layout, snapshot) > 0);
});

test("camera lift rows clamp to the hidden top buffer", () => {
  assert.equal(getCameraLiftRows(BOARD_ROWS, BOARD_ROWS), 0);
  assert.equal(getCameraLiftRows(12, BOARD_ROWS), 0);
  assert.equal(getCameraLiftRows(8, BOARD_ROWS), 4);
  assert.equal(getCameraLiftRows(0, BOARD_ROWS), 8);
});

test("camera starts lifting before the tower reaches the hidden spawn rows", () => {
  const layout = createLayout();
  const snapshot = createSnapshot([10, 11, 12, 13]);

  assert.ok(getCameraLiftTarget(layout, snapshot) > 0);
});

test("camera ignores the active spawn piece and only tracks settled structure", () => {
  const layout = createLayout();
  const snapshot = createSnapshot([]);
  snapshot.activePiece = {
    id: 1,
    category: "normal",
    shape: [
      [
        { x: 0, y: 0 },
        { x: 0, y: 1 },
        { x: 0, y: 2 },
      ],
    ],
    rotation: 0,
    x: 4,
    y: 0,
    surfaceStyle: "metal",
    textureSrc: null,
    textureRotation: 0,
  };

  assert.equal(getCameraLiftTarget(layout, snapshot), 0);
});

test("camera smoothing approaches the target without overshooting", () => {
  const next = advanceCameraLift(0, 80, 16.67);

  assert.ok(next > 0);
  assert.ok(next < 80);
});

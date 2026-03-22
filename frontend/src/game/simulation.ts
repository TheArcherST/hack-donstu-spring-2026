import {
  AUDIT_SHAPE,
  BLOCK_DURABILITY,
  PIECE_SHAPES,
} from "./constants.ts";
import {
  BOARD_COLS,
  BOARD_ROWS,
  DEFENSE_LEFT_START_COL,
  DEFENSE_REAR_START_COL,
  DEFENSE_RIGHT_END_COL,
  DEFENSE_RIGHT_START_COL,
} from "./board.ts";
import type {
  AttackProjectile,
  AuditBurst,
  BlockCategory,
  CableSegment,
  Cell,
  ChannelState,
  DamageLabel,
  Piece,
  Point,
  SignalPacket,
} from "./types.ts";
import { createBlockVisual } from "./visuals.ts";

interface RowCover {
  leftCovered: boolean;
  rightCovered: boolean;
  rearCovered: boolean;
  leftStrength: number;
  rightStrength: number;
  rearStrength: number;
}

interface Metrics {
  cableSegments: CableSegment[];
  protectionLevel: number;
  linkQuality: number;
  routeCompleted: boolean;
  preservedSegments: number;
  channelState: ChannelState;
  latencyMs: number;
}

interface BlockMember {
  cell: Cell;
  x: number;
  y: number;
}

interface CableHitDebuff {
  row: number;
  ageMs: number;
}

export interface PacketLossHistoryPoint {
  second: number;
  packetLoss: number;
}

interface BlockSupportProfile {
  bottomCells: number;
  supportedCells: number;
  tiltDirection: -1 | 0 | 1;
  supportedRatio: number;
}

export interface StructureStepResult {
  movedBlocks: number;
  collapsedBlocks: number;
  collapsedCells: number;
}

export interface SimulationState {
  grid: Array<Array<Cell | null>>;
  activePiece: Piece | null;
  nextPiece: Piece;
  cableSegments: CableSegment[];
  cableStress: number[];
  cableHitDebuffs: CableHitDebuff[];
  score: number;
  destroyedSegments: number;
  preservedSegments: number;
  routeCompleted: boolean;
  protectionLevel: number;
  systemIntegrity: number;
  attackIntensity: number;
  status: "running" | "won" | "lost";
  failureReason: string | null;
  channelState: ChannelState;
  attackProjectiles: AttackProjectile[];
  damageLabels: DamageLabel[];
  auditBursts: AuditBurst[];
  signalPackets: SignalPacket[];
  deliveredPackets: number;
  droppedPackets: number;
  packetLossHistory: PacketLossHistoryPoint[];
  packetLoss: number;
  throughput: number;
  latencyMs: number;
  linkQuality: number;
  recentPacketLoss: number;
  stableHoldMs: number;
  startedAt: number | null;
  elapsedMs: number;
}

export const STABLE_TARGET_MS = 8_000;
export const CABLE_HIT_DEBUFF_PEAK_MS = 3_000;
export const CABLE_HIT_DEBUFF_TOTAL_MS = 15_000;
export const BLOCK_COLLAPSE_TOTAL_MS = 2_600;

let pieceId = 0;
let packetId = 0;

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function createEmptyGrid(): Array<Array<Cell | null>> {
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
}

export function createCableStress() {
  return Array.from({ length: BOARD_ROWS }, () => 0);
}

function createCableHitDebuffs(): CableHitDebuff[] {
  return [];
}

export function cloneGrid(grid: Array<Array<Cell | null>>) {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

export function resetSimulationCounters() {
  pieceId = 0;
  packetId = 0;
}

export function nextPacketId() {
  return ++packetId;
}

function pickCategory(): BlockCategory {
  const roll = Math.random();
  if (roll < 0.08) {
    return "audit";
  }
  if (roll < 0.28) {
    return "guard";
  }
  if (roll < 0.58) {
    return "tech";
  }
  return "normal";
}

export function makePiece(category = pickCategory()): Piece {
  const shape = category === "audit" ? AUDIT_SHAPE : PIECE_SHAPES[Math.floor(Math.random() * PIECE_SHAPES.length)];
  const id = ++pieceId;
  return {
    id,
    category,
    shape,
    rotation: 0,
    x: 2,
    y: -1,
    ...createBlockVisual(category, id, shape[0]),
  };
}

export function createSimulationState(): SimulationState {
  return {
    grid: createEmptyGrid(),
    activePiece: null,
    nextPiece: makePiece(),
    cableSegments: [],
    cableStress: createCableStress(),
    cableHitDebuffs: createCableHitDebuffs(),
    score: 0,
    destroyedSegments: 0,
    preservedSegments: 0,
    routeCompleted: false,
    protectionLevel: 0,
    systemIntegrity: 42,
    attackIntensity: 0,
    status: "running",
    failureReason: null,
    channelState: "overloaded",
    attackProjectiles: [],
    damageLabels: [],
    auditBursts: [],
    signalPackets: [],
    deliveredPackets: 0,
    droppedPackets: 0,
    packetLossHistory: [],
    packetLoss: 0,
    throughput: 0,
    latencyMs: 0,
    linkQuality: 0,
    recentPacketLoss: 0,
    stableHoldMs: 0,
    startedAt: null,
    elapsedMs: 0,
  };
}

export function getCells(piece: Piece, rotation = piece.rotation): Point[] {
  return piece.shape[rotation % piece.shape.length];
}

export function getBounds(points: Point[]) {
  return points.reduce(
    (bounds, point) => ({
      minX: Math.min(bounds.minX, point.x),
      maxX: Math.max(bounds.maxX, point.x),
      minY: Math.min(bounds.minY, point.y),
      maxY: Math.max(bounds.maxY, point.y),
    }),
    { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity },
  );
}

export function canPlace(
  grid: Array<Array<Cell | null>>,
  piece: Piece,
  offsetX = 0,
  offsetY = 0,
  rotation = piece.rotation,
) {
  return getCells(piece, rotation).every((cell) => {
    const x = piece.x + cell.x + offsetX;
    const y = piece.y + cell.y + offsetY;
    if (x < 0 || x >= BOARD_COLS || y >= BOARD_ROWS) {
      return false;
    }
    if (y < 0) {
      return true;
    }
    return !grid[y][x];
  });
}

export function collectBlockMembers(grid: Array<Array<Cell | null>>, blockId: number): BlockMember[] {
  const members: BlockMember[] = [];
  for (let y = 0; y < BOARD_ROWS; y += 1) {
    for (let x = 0; x < BOARD_COLS; x += 1) {
      const cell = grid[y][x];
      if (cell?.blockId === blockId) {
        members.push({ cell, x, y });
      }
    }
  }
  return members;
}

export function patchBlock(grid: Array<Array<Cell | null>>, blockId: number, patch: Partial<Cell>) {
  for (const member of collectBlockMembers(grid, blockId)) {
    Object.assign(member.cell, patch);
  }
}

export function removeBlock(grid: Array<Array<Cell | null>>, blockId: number) {
  for (const member of collectBlockMembers(grid, blockId)) {
    grid[member.y][member.x] = null;
  }
}

export function canShiftBlockDown(
  grid: Array<Array<Cell | null>>,
  blockId: number,
  blockedCells = new Set<string>(),
) {
  const members = collectBlockMembers(grid, blockId);
  if (members.length === 0) {
    return false;
  }

  return members.every(({ x, y }) => {
    const nextY = y + 1;
    if (nextY >= BOARD_ROWS) {
      return false;
    }
    const nextKey = `${x}:${nextY}`;
    if (blockedCells.has(nextKey)) {
      return false;
    }
    const occupant = grid[nextY][x];
    return !occupant || occupant.blockId === blockId;
  });
}

export function shiftBlockDown(grid: Array<Array<Cell | null>>, blockId: number) {
  const members = collectBlockMembers(grid, blockId);
  if (members.length === 0) {
    return false;
  }

  for (const member of members) {
    grid[member.y][member.x] = null;
  }
  for (const member of members) {
    grid[member.y + 1][member.x] = member.cell;
  }
  return true;
}

function analyzeBlockSupport(grid: Array<Array<Cell | null>>, members: BlockMember[]): BlockSupportProfile {
  const memberKeys = new Set(members.map(({ x, y }) => `${x}:${y}`));
  const bottomMembers = members.filter(({ x, y }) => !memberKeys.has(`${x}:${y + 1}`));
  const supportedBottomMembers = bottomMembers.filter(({ x, y }) => {
    if (y >= BOARD_ROWS - 1) {
      return true;
    }
    const below = grid[y + 1][x];
    return below !== null && !memberKeys.has(`${x}:${y + 1}`);
  });

  if (bottomMembers.length === 0) {
    return { bottomCells: 0, supportedCells: 0, tiltDirection: 0, supportedRatio: 0 };
  }

  const bottomXs = bottomMembers.map(({ x }) => x);
  const supportXs = supportedBottomMembers.map(({ x }) => x);
  const minBottomX = Math.min(...bottomXs);
  const maxBottomX = Math.max(...bottomXs);
  const minSupportX = supportXs.length > 0 ? Math.min(...supportXs) : minBottomX;
  const maxSupportX = supportXs.length > 0 ? Math.max(...supportXs) : maxBottomX;
  const unsupportedLeft = Math.max(0, minSupportX - minBottomX);
  const unsupportedRight = Math.max(0, maxBottomX - maxSupportX);
  const hasSupportOnBothEdges = supportXs.length > 0 && minSupportX === minBottomX && maxSupportX === maxBottomX;

  let tiltDirection: -1 | 0 | 1 = 0;
  if (!hasSupportOnBothEdges && supportedBottomMembers.length > 0 && supportedBottomMembers.length < bottomMembers.length) {
    tiltDirection = unsupportedRight >= unsupportedLeft ? 1 : -1;
  }

  return {
    bottomCells: bottomMembers.length,
    supportedCells: supportedBottomMembers.length,
    tiltDirection,
    supportedRatio: supportedBottomMembers.length / bottomMembers.length,
  };
}

export function applyStructureGravityStep(
  grid: Array<Array<Cell | null>>,
  blockedCells = new Set<string>(),
  stepMs = 140,
) {
  const blockDepths = new Map<number, number>();
  for (let y = 0; y < BOARD_ROWS; y += 1) {
    for (let x = 0; x < BOARD_COLS; x += 1) {
      const cell = grid[y][x];
      if (cell) {
        blockDepths.set(cell.blockId, y);
      }
    }
  }

  const result: StructureStepResult = {
    movedBlocks: 0,
    collapsedBlocks: 0,
    collapsedCells: 0,
  };
  const orderedBlockIds = [...blockDepths.entries()]
    .sort((left, right) => right[1] - left[1])
    .map(([blockId]) => blockId);

  for (const blockId of orderedBlockIds) {
    const members = collectBlockMembers(grid, blockId);
    const sample = members[0]?.cell;
    if (!sample) {
      continue;
    }

    const support = analyzeBlockSupport(grid, members);
    const isAlreadyCollapsing = (sample.collapseProgress ?? 0) > 0;
    const shouldCollapse =
      isAlreadyCollapsing ||
      (support.tiltDirection !== 0 &&
        support.bottomCells >= 2 &&
        support.supportedRatio <= 0.5);

    if (!shouldCollapse && canShiftBlockDown(grid, blockId, blockedCells) && support.supportedCells === 0) {
      if (shiftBlockDown(grid, blockId)) {
        patchBlock(grid, blockId, {
          fallProgress: 1,
          tiltDirection: 0,
          tiltProgress: 0,
          collapseProgress: 0,
        });
        result.movedBlocks += 1;
      }
      continue;
    }

    if (!shouldCollapse) {
      patchBlock(grid, blockId, {
        fallProgress: 0,
        tiltDirection: 0,
        tiltProgress: 0,
        collapseProgress: 0,
      });
      continue;
    }

    const collapseProgress = Math.min(1, (sample.collapseProgress ?? 0) + stepMs / BLOCK_COLLAPSE_TOTAL_MS);
    const tiltDirection = isAlreadyCollapsing
      ? ((sample.tiltDirection ?? support.tiltDirection) || 1)
      : support.tiltDirection;

    if (collapseProgress >= 1) {
      removeBlock(grid, blockId);
      result.collapsedBlocks += 1;
      result.collapsedCells += members.length;
      continue;
    }

    const nextDurability = Math.max(1, Math.ceil(sample.maxDurability * (1 - collapseProgress)));
    patchBlock(grid, blockId, {
      durability: nextDurability,
      fortified: 0,
      flash: 1,
      tiltDirection,
      tiltProgress: collapseProgress,
      collapseProgress,
      fallProgress: 0,
    });
  }

  return result;
}

export function computeBlockDurability(category: BlockCategory, cellCount: number) {
  return BLOCK_DURABILITY[category] + Math.max(0, Math.floor((cellCount - 1) / 2));
}

export function getCableHitDebuffStrength(ageMs: number) {
  if (ageMs < 0 || ageMs >= CABLE_HIT_DEBUFF_TOTAL_MS) {
    return 0;
  }

  if (ageMs <= CABLE_HIT_DEBUFF_PEAK_MS) {
    const peakProgress = ageMs / Math.max(1, CABLE_HIT_DEBUFF_PEAK_MS);
    return 1 - peakProgress * 0.45;
  }

  const tailProgress = (ageMs - CABLE_HIT_DEBUFF_PEAK_MS) / Math.max(1, CABLE_HIT_DEBUFF_TOTAL_MS - CABLE_HIT_DEBUFF_PEAK_MS);
  return 0.55 * (1 - tailProgress);
}

function getCableHitDebuffDistanceWeight(distance: number) {
  if (distance <= 0) {
    return 1;
  }
  if (distance === 1) {
    return 0.38;
  }
  if (distance === 2) {
    return 0.16;
  }
  return 0;
}

export function buildCableStressFromHitDebuffs(debuffs: CableHitDebuff[], rowCount = BOARD_ROWS) {
  const nextStress = Array.from({ length: rowCount }, () => 0);

  for (const debuff of debuffs) {
    const baseStrength = getCableHitDebuffStrength(debuff.ageMs);
    if (baseStrength <= 0) {
      continue;
    }

    for (let row = Math.max(0, debuff.row - 2); row <= Math.min(rowCount - 1, debuff.row + 2); row += 1) {
      const weight = getCableHitDebuffDistanceWeight(Math.abs(row - debuff.row));
      nextStress[row] = clamp(nextStress[row] + baseStrength * weight, 0, 1.15);
    }
  }

  return nextStress.map((value) => clamp(value, 0, 1));
}

export function ageCableHitDebuffs(debuffs: CableHitDebuff[], deltaMs: number) {
  return debuffs
    .map((debuff) => ({ ...debuff, ageMs: debuff.ageMs + deltaMs }))
    .filter((debuff) => debuff.ageMs < CABLE_HIT_DEBUFF_TOTAL_MS);
}

function measureCellStrength(cell: Cell) {
  const categoryBase =
    cell.category === "guard" ? 1.34 : cell.category === "audit" ? 1.08 : cell.category === "tech" ? 0.98 : 0.84;
  const durabilityFactor = cell.maxDurability > 0 ? cell.durability / cell.maxDurability : 0.7;
  return categoryBase + durabilityFactor * 0.22 + cell.fortified * 0.18 + (cell.audited ? 0.16 : 0);
}

function getRowCover(row: Array<Cell | null>): RowCover {
  const leftCells = row.slice(DEFENSE_LEFT_START_COL, DEFENSE_REAR_START_COL).filter(Boolean) as Cell[];
  const rearCells = row.slice(DEFENSE_REAR_START_COL, DEFENSE_RIGHT_START_COL).filter(Boolean) as Cell[];
  const rightCells = row.slice(DEFENSE_RIGHT_START_COL, DEFENSE_RIGHT_END_COL).filter(Boolean) as Cell[];

  return {
    leftCovered: leftCells.length > 0,
    rightCovered: rightCells.length > 0,
    rearCovered: rearCells.length > 0,
    leftStrength: leftCells.length > 0 ? Math.max(...leftCells.map(measureCellStrength)) : 0,
    rightStrength: rightCells.length > 0 ? Math.max(...rightCells.map(measureCellStrength)) : 0,
    rearStrength: rearCells.length > 0 ? Math.max(...rearCells.map(measureCellStrength)) : 0,
  };
}

export function withMetrics(state: SimulationState): Metrics {
  const cableSegments = new Array<CableSegment>(BOARD_ROWS);
  let cumulativeDelay = 0;
  let cumulativeDrop = 0;
  let cumulativeDim = 0;
  let cumulativeGlitch = 0;
  let stableSegments = 0;
  let unstableSegments = 0;
  let protectionTotal = 0;

  for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
    const cover = getRowCover(state.grid[row]);
    const stress = clamp(state.cableStress[row], 0, 1);
    const exposedSides = (cover.leftCovered ? 0 : 1) + (cover.rightCovered ? 0 : 1);
    const sideSupport =
      cover.leftCovered && cover.rightCovered
        ? (cover.leftStrength + cover.rightStrength) / 2
        : Math.max(cover.leftStrength, cover.rightStrength);
    const rearSupport = cover.rearStrength;
    const expectedProtection = clamp(
      (cover.rearCovered ? 0.18 : 0) +
        rearSupport * 0.28 +
        (2 - exposedSides) * 0.18 +
        sideSupport * 0.26,
      0,
      1,
    );
    const localProtection = clamp(expectedProtection - stress * (0.46 - expectedProtection * 0.12), 0, 1);

    // Gameplay-affecting transport metrics react only to actual cable-hit stress.
    cumulativeDelay = clamp(cumulativeDelay + stress * 0.052, 0, 0.76);
    cumulativeDrop = clamp(cumulativeDrop + stress * 0.032, 0, 0.82);
    cumulativeDim = clamp(cumulativeDim + stress * 0.036, 0, 0.74);
    cumulativeGlitch = clamp(cumulativeGlitch + stress * 0.058, 0, 0.48);

    const segment: CableSegment = {
      row,
      leftCovered: cover.leftCovered,
      rightCovered: cover.rightCovered,
      stress,
      expectedProtection,
      protection: localProtection,
      signalSpeed: clamp(1 - cumulativeDelay, 0.26, 1),
      signalBrightness: clamp(1 - cumulativeDim, 0.24, 1),
      dropChance: clamp(cumulativeDrop + stress * 0.12, 0, 0.88),
      glitchChance: clamp(cumulativeGlitch, 0, 0.66),
      state:
        localProtection >= 0.56 && expectedProtection >= 0.48 && stress < 0.22
          ? "stable"
          : localProtection >= 0.3 || expectedProtection >= 0.38
            ? "unstable"
            : "critical",
    };

    cableSegments[row] = segment;
    protectionTotal += localProtection;
    if (segment.state === "stable") {
      stableSegments += 1;
    } else if (segment.state === "unstable") {
      unstableSegments += 1;
    }
  }

  const averageProtection = protectionTotal / BOARD_ROWS;
  const topSegment = cableSegments[0];
  const protectionLevel = Math.round(
    clamp(averageProtection * 52 + topSegment.signalBrightness * 24 + topSegment.signalSpeed * 24, 0, 100),
  );
  const linkQuality = Math.round(
    clamp(topSegment.signalSpeed * 38 + topSegment.signalBrightness * 34 + (1 - topSegment.dropChance) * 28, 0, 100),
  );
  const latencyMs = Math.round(
    24 + (1 - topSegment.signalSpeed) * 150 + state.cableStress.reduce((sum, value) => sum + value, 0) * 7,
  );

  let channelState: ChannelState = "overloaded";
  if (linkQuality >= 66) {
    channelState = "guarded";
  } else if (linkQuality >= 40 || unstableSegments >= Math.ceil(BOARD_ROWS * 0.28)) {
    channelState = "partial";
  }

  return {
    cableSegments,
    protectionLevel,
    linkQuality,
    routeCompleted: stableSegments >= Math.ceil(BOARD_ROWS * 0.32) && topSegment.expectedProtection >= 0.42,
    preservedSegments: stableSegments,
    channelState,
    latencyMs,
  };
}

export function attackInterval(elapsedMs: number) {
  if (elapsedMs < 18_000) {
    return 2_300;
  }
  if (elapsedMs < 55_000) {
    return 1_700;
  }
  return 1_180;
}

export function dropInterval(elapsedMs: number) {
  if (elapsedMs < 18_000) {
    return 960;
  }
  if (elapsedMs < 55_000) {
    return 820;
  }
  return 700;
}

export function findTargetOnSide(grid: Array<Array<Cell | null>>, row: number, side: "left" | "right") {
  if (side === "left") {
    for (let x = 0; x < BOARD_COLS; x += 1) {
      if (grid[row][x]) {
        return x;
      }
    }
    return undefined;
  }

  for (let x = BOARD_COLS - 1; x >= 0; x -= 1) {
    if (grid[row][x]) {
      return x;
    }
  }
  return undefined;
}

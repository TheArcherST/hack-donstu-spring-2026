import {
  AUDIT_SHAPE,
  BLOCK_DURABILITY,
  BLOCK_SCORE,
  BOARD_COLS,
  BOARD_ROWS,
  MATCH_DURATION_SECONDS,
  PIECE_SHAPES,
} from "./constants";
import type {
  AuditBurst,
  BlockCategory,
  CableSegment,
  Cell,
  ChannelState,
  EngineControls,
  FinishPayload,
  GameSnapshot,
  Piece,
  Point,
  SignalPacket,
  SoundCue,
} from "./types";

interface EngineConfig {
  onStateChange: (snapshot: GameSnapshot) => void;
  onFinish: (payload: FinishPayload) => void;
  onSound: (cue: SoundCue) => void;
}

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

interface InternalState {
  grid: Array<Array<Cell | null>>;
  activePiece: Piece | null;
  nextPiece: Piece;
  cableSegments: CableSegment[];
  cableStress: number[];
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
  attackPulses: Array<{ row: number; side: "left" | "right"; age: number }>;
  auditBursts: AuditBurst[];
  signalPackets: SignalPacket[];
  deliveredPackets: number;
  droppedPackets: number;
  packetLoss: number;
  throughput: number;
  latencyMs: number;
  linkQuality: number;
  stableHoldMs: number;
  startedAt: number | null;
  elapsedMs: number;
}

const STABLE_TARGET_MS = 8_000;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function createEmptyGrid(): Array<Array<Cell | null>> {
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
}

function createCableStress() {
  return Array.from({ length: BOARD_ROWS }, () => 0);
}

function cloneGrid(grid: Array<Array<Cell | null>>) {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

let pieceId = 0;
let packetId = 0;

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

function makePiece(category = pickCategory()): Piece {
  const shape = category === "audit" ? AUDIT_SHAPE : PIECE_SHAPES[Math.floor(Math.random() * PIECE_SHAPES.length)];
  return {
    id: ++pieceId,
    category,
    shape,
    rotation: 0,
    x: 2,
    y: -1,
  };
}

function getCells(piece: Piece, rotation = piece.rotation): Point[] {
  return piece.shape[rotation % piece.shape.length];
}

function getBounds(points: Point[]) {
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

function canPlace(grid: Array<Array<Cell | null>>, piece: Piece, offsetX = 0, offsetY = 0, rotation = piece.rotation) {
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

function collectBlockMembers(grid: Array<Array<Cell | null>>, blockId: number): BlockMember[] {
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

function patchBlock(grid: Array<Array<Cell | null>>, blockId: number, patch: Partial<Cell>) {
  for (const member of collectBlockMembers(grid, blockId)) {
    Object.assign(member.cell, patch);
  }
}

function removeBlock(grid: Array<Array<Cell | null>>, blockId: number) {
  for (const member of collectBlockMembers(grid, blockId)) {
    grid[member.y][member.x] = null;
  }
}

function computeBlockDurability(category: BlockCategory, cellCount: number) {
  return BLOCK_DURABILITY[category] + Math.max(0, Math.floor((cellCount - 1) / 2));
}

function measureCellStrength(cell: Cell) {
  const categoryBase =
    cell.category === "guard" ? 1.34 : cell.category === "audit" ? 1.08 : cell.category === "tech" ? 0.98 : 0.84;
  const durabilityFactor = cell.maxDurability > 0 ? cell.durability / cell.maxDurability : 0.7;
  return categoryBase + durabilityFactor * 0.22 + cell.fortified * 0.18 + (cell.audited ? 0.16 : 0);
}

function getRowCover(row: Array<Cell | null>): RowCover {
  const leftCells = row.slice(0, 2).filter(Boolean) as Cell[];
  const rearCells = row.slice(2, 6).filter(Boolean) as Cell[];
  const rightCells = row.slice(6).filter(Boolean) as Cell[];

  return {
    leftCovered: leftCells.length > 0,
    rightCovered: rightCells.length > 0,
    rearCovered: rearCells.length > 0,
    leftStrength: leftCells.length > 0 ? Math.max(...leftCells.map(measureCellStrength)) : 0,
    rightStrength: rightCells.length > 0 ? Math.max(...rightCells.map(measureCellStrength)) : 0,
    rearStrength: rearCells.length > 0 ? Math.max(...rearCells.map(measureCellStrength)) : 0,
  };
}

function withMetrics(state: InternalState): Metrics {
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
    const localProtection = clamp(
      (cover.rearCovered ? 0.34 : 0) +
        rearSupport * 0.34 +
        (2 - exposedSides) * 0.14 +
        sideSupport * 0.22 -
        stress * 0.2,
      0,
      1,
    );
    const weakness = clamp(
      0.08 +
        (cover.rearCovered ? 0 : 0.26) +
        exposedSides * 0.16 +
        Math.max(0, 0.94 - rearSupport) * 0.2 +
        Math.max(0, 0.96 - sideSupport) * 0.1 +
        stress * 0.38,
      0.06,
      0.92,
    );

    cumulativeDelay = clamp(cumulativeDelay + weakness * 0.055, 0, 0.76);
    cumulativeDrop = clamp(cumulativeDrop + weakness * 0.027, 0, 0.82);
    cumulativeDim = clamp(cumulativeDim + weakness * 0.041, 0, 0.74);
    cumulativeGlitch = clamp(cumulativeGlitch + weakness * 0.015 + stress * 0.02, 0, 0.48);

    const segment: CableSegment = {
      row,
      leftCovered: cover.leftCovered,
      rightCovered: cover.rightCovered,
      stress,
      protection: localProtection,
      signalSpeed: clamp(1 - cumulativeDelay, 0.26, 1),
      signalBrightness: clamp(1 - cumulativeDim, 0.24, 1),
      dropChance: clamp(cumulativeDrop + stress * 0.09, 0.02, 0.88),
      glitchChance: clamp(cumulativeGlitch, 0.01, 0.66),
      state:
        localProtection >= 0.68 && cover.rearCovered && stress < 0.35
          ? "stable"
          : localProtection >= 0.4 && (cover.rearCovered || cover.leftCovered || cover.rightCovered)
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
  const protectionLevel = Math.round(clamp(averageProtection * 52 + topSegment.signalBrightness * 24 + topSegment.signalSpeed * 24, 0, 100));
  const linkQuality = Math.round(clamp(topSegment.signalSpeed * 38 + topSegment.signalBrightness * 34 + (1 - topSegment.dropChance) * 28, 0, 100));
  const latencyMs = Math.round(24 + (1 - topSegment.signalSpeed) * 150 + state.cableStress.reduce((sum, value) => sum + value, 0) * 7);

  let channelState: ChannelState = "overloaded";
  if (linkQuality >= 72) {
    channelState = "guarded";
  } else if (linkQuality >= 45 || unstableSegments >= Math.ceil(BOARD_ROWS * 0.35)) {
    channelState = "partial";
  }

  return {
    cableSegments,
    protectionLevel,
    linkQuality,
    routeCompleted: stableSegments >= Math.ceil(BOARD_ROWS * 0.45) && topSegment.protection >= 0.56,
    preservedSegments: stableSegments,
    channelState,
    latencyMs,
  };
}

function attackInterval(elapsedMs: number) {
  if (elapsedMs < 18_000) {
    return 2_300;
  }
  if (elapsedMs < 55_000) {
    return 1_700;
  }
  return 1_180;
}

function dropInterval(elapsedMs: number) {
  if (elapsedMs < 18_000) {
    return 810;
  }
  if (elapsedMs < 55_000) {
    return 690;
  }
  return 560;
}

function findTargetOnSide(grid: Array<Array<Cell | null>>, row: number, side: "left" | "right") {
  if (side === "left") {
    for (let x = 0; x < 2; x += 1) {
      if (grid[row][x]) {
        return x;
      }
    }
    for (let x = 2; x < 6; x += 1) {
      if (grid[row][x]) {
        return x;
      }
    }
    return undefined;
  }

  for (let x = BOARD_COLS - 1; x >= 6; x -= 1) {
    if (grid[row][x]) {
      return x;
    }
  }
  for (let x = 5; x >= 2; x -= 1) {
    if (grid[row][x]) {
      return x;
    }
  }
  return undefined;
}

export function createGameEngine(config: EngineConfig): EngineControls {
  const state: InternalState = {
    grid: createEmptyGrid(),
    activePiece: null,
    nextPiece: makePiece(),
    cableSegments: [],
    cableStress: createCableStress(),
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
    attackPulses: [],
    auditBursts: [],
    signalPackets: [],
    deliveredPackets: 0,
    droppedPackets: 0,
    packetLoss: 0,
    throughput: 0,
    latencyMs: 0,
    linkQuality: 0,
    stableHoldMs: 0,
    startedAt: null,
    elapsedMs: 0,
  };

  let running = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let dropAccumulator = 0;
  let attackAccumulator = 0;
  let packetAccumulator = 0;
  let recentDeliveryTimes: number[] = [];
  let recentDropTimes: number[] = [];

  function emitState() {
    config.onStateChange({
      grid: cloneGrid(state.grid),
      activePiece: state.activePiece ? { ...state.activePiece } : null,
      nextPiece: { ...state.nextPiece },
      cableSegments: state.cableSegments.map((segment) => ({ ...segment })),
      score: state.score,
      timeLeftSeconds: Math.max(0, MATCH_DURATION_SECONDS - Math.floor(state.elapsedMs / 1000)),
      protectionLevel: state.protectionLevel,
      systemIntegrity: Math.round(state.systemIntegrity),
      attackIntensity: state.attackIntensity,
      destroyedSegments: state.destroyedSegments,
      preservedSegments: state.preservedSegments,
      routeCompleted: state.routeCompleted,
      status: state.status,
      failureReason: state.failureReason,
      channelState: state.channelState,
      attackPulses: state.attackPulses.map((pulse) => ({ ...pulse })),
      auditBursts: state.auditBursts.map((burst) => ({ ...burst })),
      signalPackets: state.signalPackets.map((packet) => ({ ...packet })),
      linkQuality: state.linkQuality,
      packetLoss: state.packetLoss,
      throughput: state.throughput,
      latencyMs: state.latencyMs,
      deliveredPackets: state.deliveredPackets,
      droppedPackets: state.droppedPackets,
      stableHoldSeconds: Math.floor(state.stableHoldMs / 1000),
      stableTargetSeconds: STABLE_TARGET_MS / 1000,
      showHints: state.elapsedMs < 6_000,
      elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    });
  }

  function refreshMetrics() {
    const metrics = withMetrics(state);
    state.cableSegments = metrics.cableSegments;
    state.protectionLevel = metrics.protectionLevel;
    state.routeCompleted = metrics.routeCompleted;
    state.preservedSegments = metrics.preservedSegments;
    state.channelState = metrics.channelState;
    state.linkQuality = metrics.linkQuality;
    state.latencyMs = metrics.latencyMs;
    state.attackIntensity = Math.round(clamp(110 - state.linkQuality + state.elapsedMs / 1450, 12, 100));

    const windowStart = state.elapsedMs - 8_000;
    recentDeliveryTimes = recentDeliveryTimes.filter((time) => time >= windowStart);
    recentDropTimes = recentDropTimes.filter((time) => time >= windowStart);
    const rollingPackets = recentDeliveryTimes.length + recentDropTimes.length;
    const baselineLoss = Math.round((metrics.cableSegments[0]?.dropChance ?? 0.42) * 100);
    state.packetLoss = rollingPackets >= 6 ? Math.round((recentDropTimes.length / rollingPackets) * 100) : baselineLoss;
    state.throughput = Math.round(clamp(recentDeliveryTimes.length * 10 + state.linkQuality * 0.42, 0, 100));
  }

  function finish(status: "won" | "lost", reason: string | null) {
    if (state.status !== "running") {
      return;
    }

    state.status = status;
    state.failureReason = reason;
    running = false;
    cancelAnimationFrame(animationFrame);

    if (status === "won") {
      const timeBonus = Math.max(0, MATCH_DURATION_SECONDS - Math.floor(state.elapsedMs / 1000)) * 10;
      state.score += 620 + timeBonus + state.linkQuality * 5 + state.deliveredPackets * 2;
      config.onSound("win");
    } else {
      state.score = Math.max(0, state.score - 80);
      config.onSound("lose");
    }

    emitState();
    config.onFinish({
      score: state.score,
      won: status === "won",
      duration_seconds: Math.min(MATCH_DURATION_SECONDS, Math.ceil(state.elapsedMs / 1000)),
      protection_level: state.linkQuality,
      route_completed: state.routeCompleted,
      destroyed_segments: state.destroyedSegments,
      preserved_segments: state.preservedSegments,
      failure_reason: reason,
      extra_data: {
        systemIntegrity: Math.round(state.systemIntegrity),
        attackIntensity: state.attackIntensity,
        channelState: state.channelState,
        linkQuality: state.linkQuality,
        packetLoss: state.packetLoss,
        throughput: state.throughput,
        latencyMs: state.latencyMs,
        deliveredPackets: state.deliveredPackets,
        droppedPackets: state.droppedPackets,
        stableHoldSeconds: Math.floor(state.stableHoldMs / 1000),
        stableTargetSeconds: STABLE_TARGET_MS / 1000,
      },
    });
  }

  function spawnPiece() {
    state.activePiece = state.nextPiece;
    const bounds = getBounds(getCells(state.activePiece, 0));
    const width = bounds.maxX - bounds.minX + 1;
    state.activePiece.x = Math.floor((BOARD_COLS - width) / 2) - bounds.minX;
    state.activePiece.y = -1 - bounds.minY;
    state.activePiece.rotation = 0;
    state.nextPiece = makePiece();

    if (!canPlace(state.grid, state.activePiece)) {
      refreshMetrics();
      finish("lost", "Новые модули больше не помещаются на опоре, а линия так и не стабилизировалась.");
    }
  }

  function reinforceArea(anchorCells: Point[]) {
    const targets = new Set<number>();
    const affectedRows = new Set<number>();
    let repaired = 0;
    let boosted = 0;

    for (const anchor of anchorCells) {
      affectedRows.add(anchor.y);
      for (let y = Math.max(0, anchor.y - 2); y <= Math.min(BOARD_ROWS - 1, anchor.y + 2); y += 1) {
        affectedRows.add(y);
        for (let x = Math.max(0, anchor.x - 2); x <= Math.min(BOARD_COLS - 1, anchor.x + 2); x += 1) {
          if (Math.hypot(anchor.x - x, anchor.y - y) > 2.25) {
            continue;
          }
          const cell = state.grid[y][x];
          if (cell) {
            targets.add(cell.blockId);
          }
        }
      }
    }

    for (const blockId of targets) {
      const members = collectBlockMembers(state.grid, blockId);
      const sample = members[0]?.cell;
      if (!sample) {
        continue;
      }
      if (sample.durability < sample.maxDurability) {
        repaired += 1;
      }
      boosted += 1;
      const nextMaxDurability = Math.min(sample.baseDurability + 2, sample.maxDurability + 1);
      patchBlock(state.grid, blockId, {
        durability: nextMaxDurability,
        maxDurability: nextMaxDurability,
        fortified: Math.max(sample.fortified, 2),
        audited: true,
        flash: 1,
      });
    }

    for (const row of affectedRows) {
      state.cableStress[row] = Math.max(0, state.cableStress[row] - 0.58);
    }

    const average = anchorCells.reduce((acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }), { x: 0, y: 0 });
    state.auditBursts.push({
      x: average.x / anchorCells.length,
      y: average.y / anchorCells.length,
      age: 0,
    });

    state.systemIntegrity = Math.min(100, state.systemIntegrity + 7 + boosted * 1.8 + affectedRows.size * 0.5);
    state.score += repaired * 34 + boosted * 10;
    config.onSound("audit");
  }

  function lockPiece() {
    const activePiece = state.activePiece;
    if (!activePiece) {
      return;
    }

    const landedCells: Point[] = [];
    for (const offset of getCells(activePiece)) {
      const x = activePiece.x + offset.x;
      const y = activePiece.y + offset.y;
      if (y >= 0) {
        landedCells.push({ x, y });
      }
    }

    if (landedCells.length === 0) {
      state.activePiece = null;
      spawnPiece();
      emitState();
      return;
    }

    const baseDurability = computeBlockDurability(activePiece.category, landedCells.length);
    for (const point of landedCells) {
      state.grid[point.y][point.x] = {
        blockId: activePiece.id,
        category: activePiece.category,
        baseDurability,
        durability: baseDurability,
        maxDurability: baseDurability,
        fortified: activePiece.category === "guard" ? 2 : activePiece.category === "audit" ? 1 : 0,
        audited: activePiece.category === "guard" || activePiece.category === "audit",
        flash: 1,
      };
    }

    const anchoredRows = new Set(landedCells.map((cell) => cell.y));
    state.score += BLOCK_SCORE[activePiece.category] + landedCells.length * 10 + anchoredRows.size * 4;
    state.systemIntegrity = Math.min(100, state.systemIntegrity + (activePiece.category === "guard" ? 4.2 : 2.1) + anchoredRows.size * 0.5);
    config.onSound("lock");

    if (activePiece.category === "audit") {
      reinforceArea(landedCells);
    }

    state.activePiece = null;
    refreshMetrics();
    spawnPiece();
    emitState();
  }

  function tryMove(deltaX: number, deltaY: number) {
    const activePiece = state.activePiece;
    if (!activePiece || state.status !== "running") {
      return false;
    }
    if (!canPlace(state.grid, activePiece, deltaX, deltaY)) {
      return false;
    }
    activePiece.x += deltaX;
    activePiece.y += deltaY;
    emitState();
    return true;
  }

  function rotate() {
    const activePiece = state.activePiece;
    if (!activePiece || state.status !== "running" || activePiece.shape.length === 1) {
      return;
    }

    const nextRotation = (activePiece.rotation + 1) % activePiece.shape.length;
    for (const kick of [0, -1, 1, -2, 2]) {
      if (canPlace(state.grid, activePiece, kick, 0, nextRotation)) {
        activePiece.rotation = nextRotation;
        activePiece.x += kick;
        emitState();
        return;
      }
    }
  }

  function propagateStressUpward(fromRow: number, amount: number) {
    for (let row = fromRow - 1; row >= 0; row -= 1) {
      state.cableStress[row] = clamp(state.cableStress[row] + amount * (0.8 - row / Math.max(1, BOARD_ROWS * 1.6)), 0, 1);
    }
  }

  function performAttack() {
    if (state.status !== "running") {
      return;
    }

    const bursts = state.elapsedMs < 52_000 ? 1 : 2;
    for (let attempt = 0; attempt < bursts; attempt += 1) {
      const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
      const row = Math.floor(Math.random() * (BOARD_ROWS - 2)) + 1;
      state.attackPulses.push({ row, side, age: 0 });
      config.onSound("attack");

      const targetX = findTargetOnSide(state.grid, row, side);
      if (targetX === undefined) {
        state.cableStress[row] = clamp(state.cableStress[row] + 0.72, 0, 1);
        propagateStressUpward(row, 0.09);
        state.systemIntegrity = Math.max(0, state.systemIntegrity - 6.6);
        state.score = Math.max(0, state.score - 12);
        continue;
      }

      const target = state.grid[row][targetX];
      if (!target) {
        continue;
      }

      const members = collectBlockMembers(state.grid, target.blockId);
      const sample = members[0]?.cell;
      if (!sample) {
        continue;
      }

      patchBlock(state.grid, target.blockId, { flash: 1 });
      if (sample.fortified > 0) {
        patchBlock(state.grid, target.blockId, { fortified: sample.fortified - 1, flash: 1 });
        state.cableStress[row] = clamp(state.cableStress[row] + 0.12, 0, 1);
        state.systemIntegrity = Math.max(0, state.systemIntegrity - 0.3);
        state.score += 9;
        continue;
      }

      const nextDurability = sample.durability - 1;
      if (nextDurability <= 0) {
        removeBlock(state.grid, target.blockId);
        state.destroyedSegments += 1;
        state.cableStress[row] = clamp(state.cableStress[row] + 0.3 + members.length * 0.04, 0, 1);
        propagateStressUpward(row, 0.055);
        state.systemIntegrity = Math.max(0, state.systemIntegrity - (1.4 + members.length * 0.45));
        state.score = Math.max(0, state.score - (14 + members.length * 3));
        config.onSound("break");
      } else {
        patchBlock(state.grid, target.blockId, { durability: nextDurability, flash: 1 });
        state.cableStress[row] = clamp(state.cableStress[row] + 0.22, 0, 1);
        propagateStressUpward(row, 0.028);
        state.systemIntegrity = Math.max(0, state.systemIntegrity - (0.9 + members.length * 0.15));
        state.score = Math.max(0, state.score - 5);
      }
    }

    refreshMetrics();
    if (state.systemIntegrity <= 0) {
      finish("lost", "Связь рассыпалась: нижние участки перегрузили поток и магистраль ушла в срыв.");
      return;
    }
    emitState();
  }

  function spawnSignalPacket() {
    state.signalPackets.push({
      id: ++packetId,
      progress: BOARD_ROWS - 0.15,
      laneOffset: (Math.random() - 0.5) * 0.6,
      brightness: 1,
      corrupted: 0,
      state: "travelling",
      age: 0,
    });
  }

  function updateSignalPackets(delta: number) {
    const nextPackets: SignalPacket[] = [];

    for (const packet of state.signalPackets) {
      const current = { ...packet, age: packet.age + delta };
      if (current.state === "dropping") {
        current.progress -= (0.35 + current.corrupted * 0.3) * delta / 1000;
        current.brightness = Math.max(0, current.brightness - delta / 420);
        current.corrupted = 1;
        if (current.age < 360 && current.brightness > 0.04) {
          nextPackets.push(current);
        }
        continue;
      }

      const rowIndex = clamp(Math.floor(current.progress), 0, BOARD_ROWS - 1);
      const rowMetrics = state.cableSegments[rowIndex] ?? state.cableSegments[0];
      const nextProgress = current.progress - (2.7 + rowMetrics.signalSpeed * 1.65) * delta / 1000;
      const nextRowIndex = nextProgress < 0 ? -1 : clamp(Math.floor(nextProgress), 0, BOARD_ROWS - 1);

      current.progress = nextProgress;
      current.brightness = clamp(current.brightness * 0.992 + rowMetrics.signalBrightness * 0.01, 0.18, 1);
      current.corrupted = Math.max(0, current.corrupted - delta / 260);

      if (nextRowIndex !== rowIndex) {
        const targetSegment = state.cableSegments[Math.max(0, nextRowIndex)] ?? state.cableSegments[0];
        if (Math.random() < targetSegment.glitchChance * 0.44) {
          current.corrupted = 1;
        }
        if (Math.random() < targetSegment.dropChance * 0.33) {
          current.state = "dropping";
          current.age = 0;
          current.corrupted = 1;
          current.brightness = Math.max(0.28, current.brightness);
          state.droppedPackets += 1;
          recentDropTimes.push(state.elapsedMs);
          nextPackets.push(current);
          continue;
        }
      }

      if (current.progress < -0.25) {
        state.deliveredPackets += 1;
        recentDeliveryTimes.push(state.elapsedMs);
        state.score += 6 + Math.round(state.linkQuality * 0.05);
        continue;
      }

      nextPackets.push(current);
    }

    state.signalPackets = nextPackets;
  }

  function step(timestamp: number) {
    if (!running) {
      return;
    }
    if (!state.startedAt) {
      state.startedAt = timestamp;
    }
    if (!lastFrame) {
      lastFrame = timestamp;
    }

    const delta = timestamp - lastFrame;
    lastFrame = timestamp;
    state.elapsedMs = timestamp - state.startedAt;

    if (state.elapsedMs >= MATCH_DURATION_SECONDS * 1000) {
      refreshMetrics();
      finish("lost", "Время истекло: связь так и не вышла на устойчивый поток.");
      return;
    }

    dropAccumulator += delta;
    attackAccumulator += delta;
    packetAccumulator += delta;

    if (dropAccumulator >= dropInterval(state.elapsedMs)) {
      if (!tryMove(0, 1)) {
        lockPiece();
      }
      dropAccumulator = 0;
    }

    if (attackAccumulator >= attackInterval(state.elapsedMs)) {
      performAttack();
      attackAccumulator = 0;
    }

    refreshMetrics();

    const spawnInterval = clamp(310 - state.linkQuality * 1.35 + state.packetLoss * 0.75, 150, 340);
    while (packetAccumulator >= spawnInterval) {
      spawnSignalPacket();
      packetAccumulator -= spawnInterval;
    }
    updateSignalPackets(delta);

    for (const row of state.grid) {
      for (const cell of row) {
        if (cell) {
          cell.flash = Math.max(0, cell.flash - delta / 250);
        }
      }
    }

    state.cableStress = state.cableStress.map((value, row) => {
      const relief = state.grid[row].some(Boolean) ? 0.00044 : 0.0003;
      return Math.max(0, value - delta * relief);
    });
    state.attackPulses = state.attackPulses.map((pulse) => ({ ...pulse, age: pulse.age + delta })).filter((pulse) => pulse.age < 420);
    state.auditBursts = state.auditBursts.map((burst) => ({ ...burst, age: burst.age + delta })).filter((burst) => burst.age < 720);

    if (state.linkQuality >= 72 && state.packetLoss <= 22 && state.latencyMs <= 92) {
      state.stableHoldMs = Math.min(STABLE_TARGET_MS, state.stableHoldMs + delta);
    } else {
      state.stableHoldMs = Math.max(0, state.stableHoldMs - delta * 0.85);
    }

    refreshMetrics();
    if (state.stableHoldMs >= STABLE_TARGET_MS) {
      finish("won", null);
      return;
    }
    if (state.systemIntegrity <= 0) {
      finish("lost", "Связь рассыпалась: поток больше не проходит через магистраль.");
      return;
    }

    emitState();
    animationFrame = requestAnimationFrame(step);
  }

  function start() {
    state.grid = createEmptyGrid();
    state.activePiece = null;
    state.nextPiece = makePiece();
    state.cableSegments = [];
    state.cableStress = createCableStress();
    state.score = 0;
    state.destroyedSegments = 0;
    state.preservedSegments = 0;
    state.routeCompleted = false;
    state.protectionLevel = 0;
    state.systemIntegrity = 42;
    state.attackIntensity = 12;
    state.status = "running";
    state.failureReason = null;
    state.channelState = "overloaded";
    state.attackPulses = [];
    state.auditBursts = [];
    state.signalPackets = [];
    state.deliveredPackets = 0;
    state.droppedPackets = 0;
    state.packetLoss = 0;
    state.throughput = 0;
    state.latencyMs = 0;
    state.linkQuality = 0;
    state.stableHoldMs = 0;
    state.startedAt = null;
    state.elapsedMs = 0;
    lastFrame = 0;
    dropAccumulator = 0;
    attackAccumulator = 0;
    packetAccumulator = 0;
    recentDeliveryTimes = [];
    recentDropTimes = [];
    spawnPiece();
    refreshMetrics();
    emitState();
    running = true;
    animationFrame = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    cancelAnimationFrame(animationFrame);
  }

  return {
    start,
    stop,
    moveLeft: () => {
      tryMove(-1, 0);
    },
    moveRight: () => {
      tryMove(1, 0);
    },
    rotate,
    softDrop: () => {
      if (!tryMove(0, 1)) {
        lockPiece();
      }
    },
    hardDrop: () => {
      if (!state.activePiece || state.status !== "running") {
        return;
      }
      let steps = 0;
      while (tryMove(0, 1)) {
        steps += 1;
      }
      state.score += steps * 2;
      lockPiece();
    },
  };
}

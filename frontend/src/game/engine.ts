import {
  AUDIT_SHAPE,
  BLOCK_DURABILITY,
  BLOCK_SCORE,
  BOARD_COLS,
  BOARD_ROWS,
  MATCH_DURATION_SECONDS,
  PIECE_SHAPES,
  WIN_PROTECTION_THRESHOLD,
} from "./constants";
import type {
  AuditBurst,
  BlockCategory,
  Cell,
  ChannelState,
  EngineControls,
  FinishPayload,
  GameSnapshot,
  Piece,
  Point,
  SoundCue,
} from "./types";

interface EngineConfig {
  onStateChange: (snapshot: GameSnapshot) => void;
  onFinish: (payload: FinishPayload) => void;
  onSound: (cue: SoundCue) => void;
}

interface Metrics {
  protectionLevel: number;
  routeCompleted: boolean;
  preservedSegments: number;
  channelState: ChannelState;
}

interface InternalState {
  grid: Array<Array<Cell | null>>;
  activePiece: Piece | null;
  nextPiece: Piece;
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
  startedAt: number | null;
  elapsedMs: number;
}

function createEmptyGrid(): Array<Array<Cell | null>> {
  return Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => null));
}

function cloneGrid(grid: Array<Array<Cell | null>>) {
  return grid.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

let pieceId = 0;

function pickCategory(): BlockCategory {
  const roll = Math.random();
  if (roll < 0.06) {
    return "audit";
  }
  if (roll < 0.24) {
    return "guard";
  }
  if (roll < 0.48) {
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

function withMetrics(state: InternalState): Metrics {
  const visited = new Set<string>();
  const queue: Point[] = [];
  let minRow = BOARD_ROWS - 1;
  let protectedCount = 0;
  let connectedCount = 0;
  let damagedCount = 0;

  for (let x = 0; x < BOARD_COLS; x += 1) {
    if (state.grid[BOARD_ROWS - 1][x]) {
      queue.push({ x, y: BOARD_ROWS - 1 });
      visited.add(`${x}:${BOARD_ROWS - 1}`);
    }
  }

  while (queue.length > 0) {
    const current = queue.shift()!;
    const cell = state.grid[current.y][current.x];
    if (!cell) {
      continue;
    }
    connectedCount += 1;
    minRow = Math.min(minRow, current.y);
    if (cell.category === "guard" || cell.category === "audit" || cell.fortified > 0 || cell.audited) {
      protectedCount += 1;
    }
    if (cell.durability < cell.maxDurability) {
      damagedCount += 1;
    }

    const neighbors = [
      { x: current.x + 1, y: current.y },
      { x: current.x - 1, y: current.y },
      { x: current.x, y: current.y + 1 },
      { x: current.x, y: current.y - 1 },
    ];
    for (const neighbor of neighbors) {
      if (neighbor.x < 0 || neighbor.x >= BOARD_COLS || neighbor.y < 0 || neighbor.y >= BOARD_ROWS) {
        continue;
      }
      const key = `${neighbor.x}:${neighbor.y}`;
      if (visited.has(key) || !state.grid[neighbor.y][neighbor.x]) {
        continue;
      }
      visited.add(key);
      queue.push(neighbor);
    }
  }

  const occupiedCount = state.grid.flat().filter(Boolean).length;
  const routeCompleted = visited.size > 0 && minRow === 0;
  const progress = occupiedCount > 0 ? 1 - minRow / (BOARD_ROWS - 1) : 0;
  const coverage = occupiedCount > 0 ? connectedCount / occupiedCount : 0;
  const resilience = connectedCount > 0 ? protectedCount / connectedCount : 0;
  const damagePenalty = connectedCount > 0 ? damagedCount / connectedCount : 0;
  const composite =
    progress * 0.44 +
    coverage * 0.2 +
    resilience * 0.26 +
    Math.max(0, 1 - damagePenalty) * 0.1;
  const protectionLevel = Math.round(Math.max(0, Math.min(100, composite * 70 + state.systemIntegrity * 0.3)));

  let channelState: ChannelState = "overloaded";
  if (protectionLevel >= WIN_PROTECTION_THRESHOLD) {
    channelState = "guarded";
  } else if (protectionLevel >= 38) {
    channelState = "partial";
  }

  return {
    protectionLevel,
    routeCompleted,
    preservedSegments: protectedCount,
    channelState,
  };
}

function attackInterval(elapsedMs: number) {
  if (elapsedMs < 15_000) {
    return 2_400;
  }
  if (elapsedMs < 50_000) {
    return 1_750;
  }
  return 1_150;
}

function dropInterval(elapsedMs: number) {
  if (elapsedMs < 15_000) {
    return 800;
  }
  if (elapsedMs < 50_000) {
    return 690;
  }
  return 560;
}

export function createGameEngine(config: EngineConfig): EngineControls {
  const state: InternalState = {
    grid: createEmptyGrid(),
    activePiece: null,
    nextPiece: makePiece(),
    score: 0,
    destroyedSegments: 0,
    preservedSegments: 0,
    routeCompleted: false,
    protectionLevel: 0,
    systemIntegrity: 34,
    attackIntensity: 0,
    status: "running",
    failureReason: null,
    channelState: "overloaded",
    attackPulses: [],
    auditBursts: [],
    startedAt: null,
    elapsedMs: 0,
  };

  let running = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let dropAccumulator = 0;
  let attackAccumulator = 0;

  function emitState() {
    config.onStateChange({
      grid: cloneGrid(state.grid),
      activePiece: state.activePiece ? { ...state.activePiece } : null,
      nextPiece: { ...state.nextPiece },
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
      showHints: state.elapsedMs < 2_500,
      elapsedSeconds: Math.floor(state.elapsedMs / 1000),
    });
  }

  function refreshMetrics() {
    const metrics = withMetrics(state);
    state.protectionLevel = metrics.protectionLevel;
    state.routeCompleted = metrics.routeCompleted;
    state.preservedSegments = metrics.preservedSegments;
    state.channelState = metrics.channelState;
    state.attackIntensity = Math.round(
      Math.min(100, Math.max(12, 100 - state.protectionLevel + state.elapsedMs / 1400)),
    );
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
      const timeBonus = Math.max(0, MATCH_DURATION_SECONDS - Math.floor(state.elapsedMs / 1000)) * 8;
      state.score += 500 + timeBonus + state.protectionLevel * 4;
      config.onSound("win");
    } else {
      state.score = Math.max(0, state.score - 100);
      config.onSound("lose");
    }

    emitState();
    config.onFinish({
      score: state.score,
      won: status === "won",
      duration_seconds: Math.min(MATCH_DURATION_SECONDS, Math.ceil(state.elapsedMs / 1000)),
      protection_level: state.protectionLevel,
      route_completed: state.routeCompleted,
      destroyed_segments: state.destroyedSegments,
      preserved_segments: state.preservedSegments,
      failure_reason: reason,
      extra_data: {
        systemIntegrity: Math.round(state.systemIntegrity),
        attackIntensity: state.attackIntensity,
        channelState: state.channelState,
      },
    });
  }

  function spawnPiece() {
    state.activePiece = state.nextPiece;
    state.activePiece.x = Math.floor(BOARD_COLS / 2) - 2;
    state.activePiece.y = -1;
    state.activePiece.rotation = 0;
    state.nextPiece = makePiece();

    if (!canPlace(state.grid, state.activePiece)) {
      refreshMetrics();
      finish("lost", "Поле перегружено раньше восстановления маршрута.");
    }
  }

  function reinforceArea(anchorCells: Point[]) {
    const targets = new Set<string>();
    let repaired = 0;
    let boost = 0;

    for (const anchor of anchorCells) {
      for (let y = Math.max(0, anchor.y - 2); y <= Math.min(BOARD_ROWS - 1, anchor.y + 2); y += 1) {
        for (let x = Math.max(0, anchor.x - 2); x <= Math.min(BOARD_COLS - 1, anchor.x + 2); x += 1) {
          const distance = Math.hypot(anchor.x - x, anchor.y - y);
          if (distance > 2.2) {
            continue;
          }
          const cell = state.grid[y][x];
          if (!cell) {
            continue;
          }
          const key = `${x}:${y}`;
          if (!targets.has(key)) {
            targets.add(key);
            boost += 1;
          }
          if (cell.category !== "guard" && cell.category !== "audit") {
            cell.maxDurability = Math.min(4, cell.maxDurability + 1);
          }
          if (cell.durability < cell.maxDurability) {
            repaired += 1;
          }
          cell.durability = cell.maxDurability;
          cell.fortified = Math.max(cell.fortified, 2);
          cell.audited = true;
          cell.flash = 1;
        }
      }
    }

    const average = anchorCells.reduce(
      (acc, point) => ({ x: acc.x + point.x, y: acc.y + point.y }),
      { x: 0, y: 0 },
    );
    state.auditBursts.push({
      x: average.x / anchorCells.length,
      y: average.y / anchorCells.length,
      age: 0,
    });
    state.systemIntegrity = Math.min(100, state.systemIntegrity + 14 + boost * 0.9);
    state.score += repaired * 25 + boost * 8;
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
      if (y < 0) {
        continue;
      }
      state.grid[y][x] = {
        category: activePiece.category,
        durability: BLOCK_DURABILITY[activePiece.category],
        maxDurability: BLOCK_DURABILITY[activePiece.category],
        fortified: 0,
        audited: activePiece.category === "guard",
        flash: 1,
      };
      landedCells.push({ x, y });
    }

    state.score += BLOCK_SCORE[activePiece.category];
    state.systemIntegrity = Math.min(100, state.systemIntegrity + (activePiece.category === "guard" ? 5 : 2));
    config.onSound("lock");

    if (activePiece.category === "audit" && landedCells.length > 0) {
      reinforceArea(landedCells);
    }

    state.activePiece = null;
    refreshMetrics();
    if (state.routeCompleted && state.protectionLevel >= WIN_PROTECTION_THRESHOLD) {
      finish("won", null);
      return;
    }

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
    const kicks = [0, -1, 1, -2, 2];
    for (const kick of kicks) {
      if (canPlace(state.grid, activePiece, kick, 0, nextRotation)) {
        activePiece.rotation = nextRotation;
        activePiece.x += kick;
        emitState();
        return;
      }
    }
  }

  function performAttack() {
    if (state.status !== "running") {
      return;
    }

    const bursts = state.elapsedMs < 50_000 ? 1 : 2;
    for (let attempt = 0; attempt < bursts; attempt += 1) {
      const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
      const row = Math.floor(Math.random() * (BOARD_ROWS - 4)) + 2;
      const pulse = { row, side, age: 0 };
      state.attackPulses.push(pulse);
      config.onSound("attack");

      const indexes =
        side === "left"
          ? Array.from({ length: BOARD_COLS }, (_, index) => index)
          : Array.from({ length: BOARD_COLS }, (_, index) => BOARD_COLS - 1 - index);
      const targetX = indexes.find((x) => Boolean(state.grid[row][x]));

      if (targetX === undefined) {
        state.systemIntegrity = Math.max(0, state.systemIntegrity - 6);
        state.score = Math.max(0, state.score - 8);
        continue;
      }

      const target = state.grid[row][targetX];
      if (!target) {
        continue;
      }

      target.flash = 1;
      if (target.category === "guard" || target.category === "audit") {
        state.score += 10;
        state.systemIntegrity = Math.min(100, state.systemIntegrity + 1.5);
        continue;
      }

      target.durability -= 1;
      if (target.fortified > 0) {
        target.fortified -= 1;
      }
      state.systemIntegrity = Math.max(0, state.systemIntegrity - 2.5);

      if (target.durability <= 0) {
        state.grid[row][targetX] = null;
        state.destroyedSegments += 1;
        state.score = Math.max(0, state.score - 14);
        config.onSound("break");
      } else {
        state.score = Math.max(0, state.score - 4);
      }
    }

    refreshMetrics();
    if (state.routeCompleted && state.protectionLevel >= WIN_PROTECTION_THRESHOLD) {
      finish("won", null);
      return;
    }
    emitState();
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
      finish("lost", "Время закончилось раньше, чем канал стал устойчивым.");
      return;
    }

    dropAccumulator += delta;
    attackAccumulator += delta;

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

    for (const row of state.grid) {
      for (const cell of row) {
        if (cell) {
          cell.flash = Math.max(0, cell.flash - delta / 250);
        }
      }
    }
    state.attackPulses = state.attackPulses
      .map((pulse) => ({ ...pulse, age: pulse.age + delta }))
      .filter((pulse) => pulse.age < 350);
    state.auditBursts = state.auditBursts
      .map((burst) => ({ ...burst, age: burst.age + delta }))
      .filter((burst) => burst.age < 700);

    emitState();
    animationFrame = requestAnimationFrame(step);
  }

  function start() {
    state.grid = createEmptyGrid();
    state.activePiece = null;
    state.nextPiece = makePiece();
    state.score = 0;
    state.destroyedSegments = 0;
    state.preservedSegments = 0;
    state.routeCompleted = false;
    state.protectionLevel = 0;
    state.systemIntegrity = 34;
    state.attackIntensity = 12;
    state.status = "running";
    state.failureReason = null;
    state.channelState = "overloaded";
    state.attackPulses = [];
    state.auditBursts = [];
    state.startedAt = null;
    state.elapsedMs = 0;
    lastFrame = 0;
    dropAccumulator = 0;
    attackAccumulator = 0;
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

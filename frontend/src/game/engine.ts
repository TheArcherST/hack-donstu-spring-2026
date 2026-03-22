import {
  FINAL_PACKET_LOSS_WIN_THRESHOLD,
  MATCH_DURATION_SECONDS,
  STABILITY_BONUS_SCORE_PER_SECOND,
  STABLE_LATENCY_THRESHOLD,
  STABLE_LINK_QUALITY_THRESHOLD,
  STABLE_PACKET_LOSS_THRESHOLD,
} from "./constants.ts";
import { BOARD_COLS, BOARD_ROWS, HIDDEN_TOP_ROWS, getPieceSpawnRow } from "./board.ts";
import { getCameraLiftRows } from "./camera.ts";
import { buildCompletionPayload, calculatePacketLoss } from "./result.ts";
import { createGameSnapshot } from "./snapshot.ts";
import {
  ageCableHitDebuffs,
  applyStructureGravityStep,
  attackInterval,
  buildCableStressFromHitDebuffs,
  canPlace,
  clamp,
  collectBlockMembers,
  computeBlockDurability,
  createSimulationState,
  dropInterval,
  findTargetOnSide,
  getBounds,
  getCells,
  makePiece,
  nextPacketId,
  patchBlock,
  removeBlock,
  resetSimulationCounters,
  type SimulationState,
  withMetrics,
} from "./simulation.ts";
import type {
  EngineControls,
  FinishPayload,
  GameSnapshot,
  Point,
  SignalPacket,
  SoundCue,
} from "./types.ts";

interface EngineConfig {
  onStateChange: (snapshot: GameSnapshot) => void;
  onFinish: (payload: FinishPayload) => void;
  onSound: (cue: SoundCue) => void;
}

const SIGNAL_FRAME_COUNT = 24;
const DROPPED_SIGNAL_FADE_MS = 2_800;
const MAX_TRAVELLING_SIGNALS = 4;
const SIGNAL_TRAVEL_SPEED_MULTIPLIER = 1.5;
const STRUCTURE_GRAVITY_INTERVAL_MS = 140;
const ATTACK_PROJECTILE_TRAVEL_MS = 680;
const DAMAGE_LABEL_VISIBLE_MS = 1_500;
const SPAWN_OVERFLOW_ROWS = 5;
const SPAWN_SCREEN_ANCHOR_ROW = HIDDEN_TOP_ROWS - 1;
const DAMAGE_LABEL_TEXTURES = [
  "/attack/damage-label/ack-flood.png",
  "/attack/damage-label/dns-amp.png",
  "/attack/damage-label/http-flood.png",
  "/attack/damage-label/ntp-amp.png",
  "/attack/damage-label/syn-flood.png",
  "/attack/damage-label/udp-flood.png",
];
const RECENT_DELIVERY_WINDOW_MS = 5_000;

export function findSpawnPlacement(
  grid: SimulationState["grid"],
  piece: SimulationState["nextPiece"],
  spawnRows: number[],
  spawnColumns: number[],
) {
  for (const spawnY of spawnRows) {
    piece.y = spawnY;
    const spawnX = spawnColumns.find((candidateX) => {
      piece.x = candidateX;
      return canPlace(grid, piece);
    });

    if (spawnX !== undefined) {
      return { x: spawnX, y: spawnY };
    }
  }

  return null;
}

export function getPreferredSpawnY(topSettledRow: number, spawnCells: Point[]) {
  const liftRows = getCameraLiftRows(topSettledRow, BOARD_ROWS);
  const spawnAnchorRow = SPAWN_SCREEN_ANCHOR_ROW - liftRows;
  return getPieceSpawnRow(spawnCells) + spawnAnchorRow;
}

function getPacketFrame(progress: number) {
  const normalized = clamp((BOARD_ROWS - progress) / (BOARD_ROWS + 0.25), 0, 1);
  return Math.min(SIGNAL_FRAME_COUNT - 1, Math.floor(normalized * SIGNAL_FRAME_COUNT));
}

export function createGameEngine(config: EngineConfig): EngineControls {
  let state: SimulationState = createSimulationState();

  let running = false;
  let animationFrame = 0;
  let lastFrame = 0;
  let dropAccumulator = 0;
  let attackAccumulator = 0;
  let structureGravityAccumulator = 0;
  let packetAccumulator = 0;
  let stabilityBonusAccumulator = 0;
  let recentDeliveryTimes: number[] = [];
  let recentDropTimes: number[] = [];

  function emitState() {
    config.onStateChange(createGameSnapshot(state));
  }

  function refreshMetrics() {
    state.cableStress = buildCableStressFromHitDebuffs(state.cableHitDebuffs);
    const metrics = withMetrics(state);
    state.cableSegments = metrics.cableSegments;
    state.protectionLevel = metrics.protectionLevel;
    state.routeCompleted = metrics.routeCompleted;
    state.preservedSegments = metrics.preservedSegments;
    state.channelState = metrics.channelState;
    state.linkQuality = metrics.linkQuality;
    state.latencyMs = metrics.latencyMs;
    state.attackIntensity = Math.round(clamp(110 - state.linkQuality + state.elapsedMs / 1450, 12, 100));

    const packetLossWindowStart = state.elapsedMs - 8_000;
    recentDeliveryTimes = recentDeliveryTimes.filter((time) => time >= packetLossWindowStart);
    recentDropTimes = recentDropTimes.filter((time) => time >= packetLossWindowStart);
    const rollingPackets = recentDeliveryTimes.length + recentDropTimes.length;
    const baselineLoss = Math.round((metrics.cableSegments[0]?.dropChance ?? 0.42) * 100);
    state.packetLoss = rollingPackets >= 6 ? Math.round((recentDropTimes.length / rollingPackets) * 100) : baselineLoss;
    state.throughput = Math.round(clamp(recentDeliveryTimes.length * 10 + state.linkQuality * 0.42, 0, 100));

    const recentWindowStart = state.elapsedMs - RECENT_DELIVERY_WINDOW_MS;
    const recentDeliveries = recentDeliveryTimes.filter((time) => time >= recentWindowStart).length;
    const recentDrops = recentDropTimes.filter((time) => time >= recentWindowStart).length;
    const recentTotal = recentDeliveries + recentDrops;
    state.recentPacketLoss = recentTotal > 0 ? Math.round((recentDrops / recentTotal) * 100) : 0;
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
      config.onSound("win");
    } else {
      config.onSound("lose");
    }

    emitState();
    config.onFinish(buildCompletionPayload(state));
  }

  function spawnPiece() {
    state.activePiece = state.nextPiece;
    const spawnCells = getCells(state.activePiece, 0);
    const bounds = getBounds(spawnCells);
    const width = bounds.maxX - bounds.minX + 1;

    let topSettledRow = BOARD_ROWS;
    for (let row = 0; row < BOARD_ROWS; row += 1) {
      if (state.grid[row].some(Boolean)) {
        topSettledRow = row;
        break;
      }
    }

    state.activePiece.rotation = 0;
    state.nextPiece = makePiece();

    const minSpawnX = -bounds.minX;
    const maxSpawnX = BOARD_COLS - width - bounds.minX;
    const centeredSpawnX = Math.floor((BOARD_COLS - width) / 2) - bounds.minX;
    const spawnColumns = Array.from({ length: Math.max(0, maxSpawnX - minSpawnX + 1) }, (_, index) => minSpawnX + index).sort(
      (left, right) => Math.abs(left - centeredSpawnX) - Math.abs(right - centeredSpawnX),
    );

    const preferredSpawnY = getPreferredSpawnY(topSettledRow, spawnCells);
    const spawnRows = Array.from({ length: SPAWN_OVERFLOW_ROWS + 1 }, (_, index) => preferredSpawnY - index);
    const resolvedSpawn = findSpawnPlacement(state.grid, state.activePiece, spawnRows, spawnColumns);

    if (!resolvedSpawn) {
      refreshMetrics();
      finish("lost", "Новые модули больше не помещаются на опоре, а линия так и не стабилизировалась.");
      return;
    }

    state.activePiece.x = resolvedSpawn.x;
    state.activePiece.y = resolvedSpawn.y;
  }

  function isStableChannel() {
    return (
      state.linkQuality >= STABLE_LINK_QUALITY_THRESHOLD &&
      state.packetLoss <= STABLE_PACKET_LOSS_THRESHOLD &&
      state.latencyMs <= STABLE_LATENCY_THRESHOLD
    );
  }

  function finishByTimer() {
    const packetLoss = calculatePacketLoss(state.deliveredPackets, state.droppedPackets);
    if (packetLoss <= FINAL_PACKET_LOSS_WIN_THRESHOLD) {
      finish("won", null);
      return;
    }

    finish("lost", "Время истекло: доля потерянных пакетов осталась слишком высокой.");
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
        surfaceStyle: activePiece.surfaceStyle,
        textureSrc: activePiece.textureSrc,
        textureRotation: activePiece.textureRotation,
        fallProgress: 0,
        tiltDirection: 0,
        tiltProgress: 0,
        collapseProgress: 0,
      };
    }

    const anchoredRows = new Set(landedCells.map((cell) => cell.y));
    state.systemIntegrity = Math.min(
      100,
      state.systemIntegrity + (activePiece.category === "guard" ? 4.2 : 2.1) + anchoredRows.size * 0.5,
    );
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
        activePiece.textureRotation += Math.PI / 2;
        emitState();
        return;
      }
    }
  }

  function getActivePieceBlockedCells() {
    const blockedCells = new Set<string>();
    if (!state.activePiece) {
      return blockedCells;
    }

    for (const cell of getCells(state.activePiece)) {
      const x = state.activePiece.x + cell.x;
      const y = state.activePiece.y + cell.y;
      if (x < 0 || x >= BOARD_COLS || y < 0 || y >= BOARD_ROWS) {
        continue;
      }
      blockedCells.add(`${x}:${y}`);
    }
    return blockedCells;
  }

  function applyStructureGravity() {
    const blockedCells = getActivePieceBlockedCells();
    const result = applyStructureGravityStep(state.grid, blockedCells, STRUCTURE_GRAVITY_INTERVAL_MS);
    if (result.collapsedBlocks > 0) {
      state.destroyedSegments += result.collapsedBlocks;
      state.systemIntegrity = Math.max(0, state.systemIntegrity - (result.collapsedBlocks * 1.2 + result.collapsedCells * 0.35));
      config.onSound("break");
    }
    return result;
  }

  function performAttack() {
    if (state.status !== "running") {
      return;
    }

    const bursts = state.elapsedMs < 52_000 ? 1 : 2;
    for (let attempt = 0; attempt < bursts; attempt += 1) {
      const side: "left" | "right" = Math.random() > 0.5 ? "left" : "right";
      const attackRows = Math.max(1, BOARD_ROWS - HIDDEN_TOP_ROWS - 2);
      const row = HIDDEN_TOP_ROWS + Math.floor(Math.random() * attackRows);
      config.onSound("attack");

      const targetX = findTargetOnSide(state.grid, row, side);
      state.attackProjectiles.push({
        row,
        side,
        age: 0,
        targetCol: targetX ?? null,
        impact: targetX === undefined ? "cable" : "block",
      });
      if (targetX === undefined) {
        const textureSrc = DAMAGE_LABEL_TEXTURES[Math.floor(Math.random() * DAMAGE_LABEL_TEXTURES.length)];
        state.damageLabels.push({
          row,
          side,
          age: 0,
          delayMs: ATTACK_PROJECTILE_TRAVEL_MS,
          textureSrc,
        });
        state.cableHitDebuffs.push({ row, ageMs: 0 });
        state.systemIntegrity = Math.max(0, state.systemIntegrity - 6.6);
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
        state.systemIntegrity = Math.max(0, state.systemIntegrity - 0.3);
        continue;
      }

      const nextDurability = sample.durability - 1;
      if (nextDurability <= 0) {
        removeBlock(state.grid, target.blockId);
        state.destroyedSegments += 1;
        state.systemIntegrity = Math.max(0, state.systemIntegrity - (1.4 + members.length * 0.45));
        config.onSound("break");
      } else {
        patchBlock(state.grid, target.blockId, { durability: nextDurability, flash: 1 });
        state.systemIntegrity = Math.max(0, state.systemIntegrity - (0.9 + members.length * 0.15));
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
      id: nextPacketId(),
      progress: BOARD_ROWS - 0.15,
      laneOffset: 0,
      brightness: 1,
      corrupted: 0,
      state: "travelling",
      age: 0,
      frozenFrame: null,
    });
  }

  function updateSignalPackets(delta: number) {
    const nextPackets: SignalPacket[] = [];

    for (const packet of state.signalPackets) {
      const current = { ...packet, age: packet.age + delta };
      if (current.state === "dropping") {
        current.brightness = Math.max(0, current.brightness - delta / DROPPED_SIGNAL_FADE_MS);
        current.corrupted = 1;
        if (current.age < DROPPED_SIGNAL_FADE_MS && current.brightness > 0.03) {
          nextPackets.push(current);
        }
        continue;
      }

      const rowIndex = clamp(Math.floor(current.progress), 0, BOARD_ROWS - 1);
      const rowMetrics = state.cableSegments[rowIndex] ?? state.cableSegments[0];
      const nextProgress =
        current.progress - (((2.7 + rowMetrics.signalSpeed * 1.65) * SIGNAL_TRAVEL_SPEED_MULTIPLIER) * delta) / 1000;
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
          current.brightness = Math.max(0.58, current.brightness);
          current.frozenFrame = getPacketFrame(current.progress);
          state.droppedPackets += 1;
          recentDropTimes.push(state.elapsedMs);
          nextPackets.push(current);
          continue;
        }
      }

      if (current.progress < -0.25) {
        state.deliveredPackets += 1;
        recentDeliveryTimes.push(state.elapsedMs);
        state.score += 1;
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
      finishByTimer();
      return;
    }

    dropAccumulator += delta;
    attackAccumulator += delta;
    structureGravityAccumulator += delta;
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

    while (structureGravityAccumulator >= STRUCTURE_GRAVITY_INTERVAL_MS) {
      applyStructureGravity();
      structureGravityAccumulator -= STRUCTURE_GRAVITY_INTERVAL_MS;
    }

    refreshMetrics();

    const spawnInterval = clamp(1_050 - state.linkQuality * 4 + state.packetLoss * 7, 520, 1_350);
    let travellingSignals = state.signalPackets.filter((packet) => packet.state === "travelling").length;
    while (packetAccumulator >= spawnInterval && travellingSignals < MAX_TRAVELLING_SIGNALS) {
      spawnSignalPacket();
      packetAccumulator -= spawnInterval;
      travellingSignals += 1;
    }
    updateSignalPackets(delta);

    for (const row of state.grid) {
      for (const cell of row) {
        if (cell) {
          cell.flash = Math.max(0, cell.flash - delta / 250);
          cell.fallProgress = Math.max(0, (cell.fallProgress ?? 0) - delta / 180);
          if ((cell.collapseProgress ?? 0) <= 0) {
            cell.tiltProgress = Math.max(0, (cell.tiltProgress ?? 0) - delta / 220);
          }
        }
      }
    }

    state.cableHitDebuffs = ageCableHitDebuffs(state.cableHitDebuffs, delta);
    state.attackProjectiles = state.attackProjectiles
      .map((projectile) => ({ ...projectile, age: projectile.age + delta }))
      .filter((projectile) => projectile.age < ATTACK_PROJECTILE_TRAVEL_MS);
    state.damageLabels = state.damageLabels
      .map((label) => ({ ...label, age: label.age + delta }))
      .filter((label) => label.age < label.delayMs + DAMAGE_LABEL_VISIBLE_MS);
    state.auditBursts = state.auditBursts
      .map((burst) => ({ ...burst, age: burst.age + delta }))
      .filter((burst) => burst.age < 720);

    if (isStableChannel()) {
      state.stableHoldMs += delta;
      stabilityBonusAccumulator += delta;
      while (stabilityBonusAccumulator >= 1_000) {
        state.score += STABILITY_BONUS_SCORE_PER_SECOND;
        stabilityBonusAccumulator -= 1_000;
      }
    }

    refreshMetrics();
    if (state.systemIntegrity <= 0) {
      finish("lost", "Связь рассыпалась: поток больше не проходит через магистраль.");
      return;
    }

    emitState();
    animationFrame = requestAnimationFrame(step);
  }

  function start() {
    resetSimulationCounters();
    state = createSimulationState();
    lastFrame = 0;
    dropAccumulator = 0;
    attackAccumulator = 0;
    structureGravityAccumulator = 0;
    packetAccumulator = 0;
    stabilityBonusAccumulator = 0;
    recentDeliveryTimes = [];
    recentDropTimes = [];
    spawnPiece();
    spawnSignalPacket();
    spawnSignalPacket();
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
      while (tryMove(0, 1)) {
        continue;
      }
      lockPiece();
    },
  };
}

import { MATCH_DURATION_SECONDS } from "./constants.ts";
import { STABLE_TARGET_MS, type SimulationState } from "./simulation.ts";
import type { GameHudSnapshot, GameSnapshot, RenderBlock } from "./types.ts";

function summarizeGrid(grid: SimulationState["grid"]) {
  const blocks = new Map<number, RenderBlock>();
  let topSettledRow = grid.length;

  for (let rowIndex = 0; rowIndex < grid.length; rowIndex += 1) {
    const row = grid[rowIndex];
    let rowOccupied = false;

    for (let colIndex = 0; colIndex < row.length; colIndex += 1) {
      const cell = row[colIndex];
      if (!cell) {
        continue;
      }

      rowOccupied = true;
      const block = blocks.get(cell.blockId);
      if (block) {
        block.cells.push({ col: colIndex, row: rowIndex });
      } else {
        blocks.set(cell.blockId, {
          cell,
          cells: [{ col: colIndex, row: rowIndex }],
        });
      }
    }

    if (rowOccupied && topSettledRow === grid.length) {
      topSettledRow = rowIndex;
    }
  }

  return {
    blocks: [...blocks.values()],
    topSettledRow,
  };
}

export function createGameSnapshot(state: SimulationState): GameSnapshot {
  const { blocks, topSettledRow } = summarizeGrid(state.grid);

  return {
    grid: state.grid,
    blocks,
    topSettledRow,
    activePiece: state.activePiece,
    nextPiece: state.nextPiece,
    cableSegments: state.cableSegments,
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
    attackProjectiles: state.attackProjectiles,
    damageLabels: state.damageLabels,
    auditBursts: state.auditBursts,
    signalPackets: state.signalPackets,
    linkQuality: state.linkQuality,
    packetLoss: state.packetLoss,
    throughput: state.throughput,
    latencyMs: state.latencyMs,
    deliveredPackets: state.deliveredPackets,
    droppedPackets: state.droppedPackets,
    activeIncidents: state.cableHitDebuffs.length,
    recentPacketLoss: state.recentPacketLoss,
    stableHoldSeconds: Math.floor(state.stableHoldMs / 1000),
    stableTargetSeconds: STABLE_TARGET_MS / 1000,
    showHints: state.elapsedMs < 6_000,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
  };
}

export function createHudSnapshot(snapshot: GameSnapshot): GameHudSnapshot {
  return {
    packetLoss: snapshot.packetLoss,
    activeIncidents: snapshot.activeIncidents,
    timeLeftSeconds: snapshot.timeLeftSeconds,
  };
}

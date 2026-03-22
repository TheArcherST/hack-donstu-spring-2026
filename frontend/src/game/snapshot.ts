import { MATCH_DURATION_SECONDS } from "./constants.ts";
import { STABLE_TARGET_MS, cloneGrid, type SimulationState } from "./simulation.ts";
import type { GameSnapshot } from "./types.ts";

export function createGameSnapshot(state: SimulationState): GameSnapshot {
  return {
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
    attackProjectiles: state.attackProjectiles.map((projectile) => ({ ...projectile })),
    damageLabels: state.damageLabels.map((label) => ({ ...label })),
    auditBursts: state.auditBursts.map((burst) => ({ ...burst })),
    signalPackets: state.signalPackets.map((packet) => ({ ...packet })),
    linkQuality: state.linkQuality,
    packetLoss: state.packetLoss,
    throughput: state.throughput,
    latencyMs: state.latencyMs,
    deliveredPackets: state.deliveredPackets,
    droppedPackets: state.droppedPackets,
    recentPacketLoss: state.recentPacketLoss,
    stableHoldSeconds: Math.floor(state.stableHoldMs / 1000),
    stableTargetSeconds: STABLE_TARGET_MS / 1000,
    showHints: state.elapsedMs < 6_000,
    elapsedSeconds: Math.floor(state.elapsedMs / 1000),
  };
}

import type { SessionResultDetails } from "../types.ts";
import { FINAL_PACKET_LOSS_WIN_THRESHOLD, MATCH_DURATION_SECONDS } from "./constants.ts";
import type { FinishPayload } from "./types.ts";
import { STABLE_TARGET_MS, type SimulationState } from "./simulation.ts";

export function calculateDeliveryRate(deliveredPackets: number, droppedPackets: number) {
  const totalPackets = deliveredPackets + droppedPackets;
  if (totalPackets <= 0) {
    return 0;
  }

  return Math.round((deliveredPackets / totalPackets) * 100);
}

export function calculatePacketLoss(deliveredPackets: number, droppedPackets: number) {
  const totalPackets = deliveredPackets + droppedPackets;
  if (totalPackets <= 0) {
    return 0;
  }

  return Math.round((droppedPackets / totalPackets) * 100);
}

export function hasWonByPacketLoss(packetLoss: number) {
  return packetLoss < FINAL_PACKET_LOSS_WIN_THRESHOLD;
}

export function buildResultDetails(state: SimulationState): SessionResultDetails {
  const totalPacketLoss = calculatePacketLoss(state.deliveredPackets, state.droppedPackets);
  return {
    network_metrics: {
      link_quality: state.linkQuality,
      packet_loss: totalPacketLoss,
      throughput: state.throughput,
      latency_ms: state.latencyMs,
      delivered_packets: state.deliveredPackets,
      dropped_packets: state.droppedPackets,
      delivery_rate: calculateDeliveryRate(state.deliveredPackets, state.droppedPackets),
      channel_state: state.channelState,
    },
    stability_window: {
      hold_seconds: Math.floor(state.stableHoldMs / 1000),
      target_seconds: STABLE_TARGET_MS / 1000,
    },
    attack_summary: {
      system_integrity: Math.round(state.systemIntegrity),
      attack_intensity: state.attackIntensity,
    },
    packet_loss_timeline:
      state.packetLossHistory.length > 0
        ? state.packetLossHistory.map((point) => ({
            second: point.second,
            packet_loss: point.packetLoss,
          }))
        : [{ second: 0, packet_loss: totalPacketLoss }],
  };
}

export function buildCompletionPayload(state: SimulationState): FinishPayload {
  return {
    score: state.score,
    won: state.status === "won",
    duration_seconds: Math.min(MATCH_DURATION_SECONDS, Math.ceil(state.elapsedMs / 1000)),
    protection_level: state.protectionLevel,
    route_completed: state.routeCompleted,
    destroyed_segments: state.destroyedSegments,
    preserved_segments: state.preservedSegments,
    failure_reason: state.failureReason,
    result_details: buildResultDetails(state),
  };
}

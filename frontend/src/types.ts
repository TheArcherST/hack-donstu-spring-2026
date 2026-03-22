export type ChannelState = "overloaded" | "partial" | "guarded";

export interface NetworkMetrics {
  link_quality: number;
  packet_loss: number;
  throughput: number;
  latency_ms: number;
  delivered_packets: number;
  dropped_packets: number;
  delivery_rate: number;
  channel_state: ChannelState;
}

export interface StabilityWindow {
  hold_seconds: number;
  target_seconds: number;
}

export interface AttackSummary {
  system_integrity: number;
  attack_intensity: number;
}

export interface SessionResultDetails {
  network_metrics: NetworkMetrics;
  stability_window: StabilityWindow;
  attack_summary: AttackSummary;
}

export interface ParticipantPayload {
  first_name: string;
  last_name: string;
  phone: string;
  telegram?: string | null;
  consent: boolean;
}

export interface Participant {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  telegram: string | null;
  consent: boolean;
  created_at: string;
}

export interface GameSession {
  id: number;
  participant_id: number;
  status: string;
  score: number;
  won: boolean;
  duration_seconds: number;
  protection_level: number;
  route_completed: boolean;
  destroyed_segments: number;
  preserved_segments: number;
  failure_reason: string | null;
  prize_issued: boolean;
  result_details: SessionResultDetails;
  created_at: string;
  completed_at: string | null;
}

export interface BootstrapResponse {
  participant: Participant;
  session: GameSession;
}

export interface LeaderboardEntry {
  session_id: number;
  full_name: string;
  score: number;
  won: boolean;
  protection_level: number;
  packet_loss: number;
  delivered_packets: number;
  completed_at: string | null;
}

export interface CompletionPayload {
  score: number;
  won: boolean;
  duration_seconds: number;
  protection_level: number;
  route_completed: boolean;
  destroyed_segments: number;
  preserved_segments: number;
  failure_reason?: string | null;
  result_details: SessionResultDetails;
}

export interface CompletionResult {
  session: GameSession;
  rank: number;
  leaderboard: LeaderboardEntry[];
}

export interface AdminEntry {
  session_id: number;
  participant_id: number;
  first_name: string;
  last_name: string;
  phone: string;
  telegram: string | null;
  score: number;
  won: boolean;
  duration_seconds: number;
  protection_level: number;
  status: string;
  prize_issued: boolean;
  result_details: SessionResultDetails;
  created_at: string;
  completed_at: string | null;
}

export interface AdminEntriesResponse {
  items: AdminEntry[];
  total: number;
}

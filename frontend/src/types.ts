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
  extra_data: Record<string, unknown>;
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
  extra_data: Record<string, unknown>;
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
  created_at: string;
  completed_at: string | null;
}

export interface AdminEntriesResponse {
  items: AdminEntry[];
  total: number;
}

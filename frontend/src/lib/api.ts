import type {
  AdminEntriesResponse,
  BootstrapResponse,
  CompletionPayload,
  CompletionResult,
  LeaderboardEntry,
  ParticipantPayload,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `HTTP ${response.status}`);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }

  return (await response.text()) as T;
}

export function createParticipant(payload: ParticipantPayload) {
  return request<BootstrapResponse>("/participants", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchLeaderboard(limit = 10) {
  return request<LeaderboardEntry[]>(`/leaderboard?limit=${limit}`);
}

export function completeSession(sessionId: number, payload: CompletionPayload) {
  return request<CompletionResult>(`/sessions/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function fetchAdminEntries(params: URLSearchParams) {
  return request<AdminEntriesResponse>(`/admin/entries?${params.toString()}`);
}

export function togglePrizeIssued(sessionId: number, prizeIssued: boolean) {
  return request(`/admin/entries/${sessionId}`, {
    method: "PATCH",
    body: JSON.stringify({ prize_issued: prizeIssued }),
  });
}

export function exportCsvUrl(params?: URLSearchParams) {
  const query = params?.toString();
  return `${API_BASE_URL}/admin/export.csv${query ? `?${query}` : ""}`;
}

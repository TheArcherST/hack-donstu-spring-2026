import type {
  AdminEntriesResponse,
  BootstrapResponse,
  CompletionPayload,
  CompletionResult,
  ParticipantPayload,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

interface ApiErrorDetailItem {
  loc?: Array<string | number>;
  msg?: string;
}

function mapFieldLabel(fieldName: string) {
  const labels: Record<string, string> = {
    first_name: "Имя",
    last_name: "Фамилия",
    phone: "Телефон",
    telegram: "Telegram",
    consent: "Согласие на обработку данных",
    prize_issued: "Статус приза",
  };

  return labels[fieldName] ?? fieldName;
}

function formatValidationDetail(details: ApiErrorDetailItem[]) {
  return details
    .map((item) => {
      const fieldName = item.loc?.[item.loc.length - 1];
      const fieldLabel = typeof fieldName === "string" ? mapFieldLabel(fieldName) : "Поле";
      const message = item.msg ?? "Некорректное значение";
      return `${fieldLabel}: ${message}`;
    })
    .join("\n");
}

function formatErrorPayload(payload: unknown, fallbackMessage: string) {
  if (typeof payload === "string" && payload.trim()) {
    return payload;
  }

  if (payload && typeof payload === "object" && "detail" in payload) {
    const detail = (payload as { detail?: unknown }).detail;
    if (typeof detail === "string" && detail.trim()) {
      return detail;
    }
    if (Array.isArray(detail)) {
      return formatValidationDetail(detail as ApiErrorDetailItem[]);
    }
  }

  return fallbackMessage;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const fallbackMessage = response.status >= 500 ? "Ошибка сервера. Попробуйте ещё раз." : `HTTP ${response.status}`;
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      throw new Error(formatErrorPayload(payload, fallbackMessage));
    }
    const detail = await response.text();
    throw new Error(detail || fallbackMessage);
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

export function completeSession(sessionId: number, payload: CompletionPayload) {
  return request<CompletionResult>(`/sessions/${sessionId}/complete`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

function adminHeaders(adminPassword: string) {
  return {
    "X-Admin-Password": adminPassword,
  };
}

export function fetchAdminEntries(params: URLSearchParams, adminPassword: string) {
  return request<AdminEntriesResponse>(`/admin/entries?${params.toString()}`, {
    headers: adminHeaders(adminPassword),
  });
}

export function togglePrizeIssued(sessionId: number, prizeIssued: boolean, adminPassword: string) {
  return request(`/admin/entries/${sessionId}`, {
    method: "PATCH",
    headers: adminHeaders(adminPassword),
    body: JSON.stringify({ prize_issued: prizeIssued }),
  });
}

export async function downloadAdminCsv(params: URLSearchParams, adminPassword: string) {
  const response = await fetch(`${API_BASE_URL}/admin/export.csv?${params.toString()}`, {
    headers: adminHeaders(adminPassword),
  });

  if (!response.ok) {
    const contentType = response.headers.get("content-type") ?? "";
    const fallbackMessage = response.status >= 500 ? "Не удалось выгрузить CSV." : `HTTP ${response.status}`;
    if (contentType.includes("application/json")) {
      const payload = await response.json();
      throw new Error(formatErrorPayload(payload, fallbackMessage));
    }
    throw new Error((await response.text()) || fallbackMessage);
  }

  const blob = await response.blob();
  const downloadUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = downloadUrl;
  link.download = "ddos-guard-export.csv";
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(downloadUrl);
}

import type { Difficulty, OrchestratorResult, SessionState, UserSignal } from "../types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export function startSession(topic: string, customCriteria: string | undefined, difficulty: Difficulty) {
  return request<OrchestratorResult>("/api/session", {
    method: "POST",
    body: JSON.stringify({ topic, customCriteria: customCriteria || undefined, difficulty }),
  });
}

export function submitOpeningExplanation(sessionId: string, text: string) {
  return request<OrchestratorResult>(`/api/session/${sessionId}/explain`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function submitFollowUpAnswer(sessionId: string, text: string) {
  return request<OrchestratorResult>(`/api/session/${sessionId}/answer`, {
    method: "POST",
    body: JSON.stringify({ text }),
  });
}

export function submitSignal(sessionId: string, signal: UserSignal) {
  return request<OrchestratorResult>(`/api/session/${sessionId}/signal`, {
    method: "POST",
    body: JSON.stringify({ signal }),
  });
}

export function submitExitCheck(sessionId: string, wrapUpAnyway: boolean) {
  return request<OrchestratorResult>(`/api/session/${sessionId}/exit-check`, {
    method: "POST",
    body: JSON.stringify({ wrapUpAnyway }),
  });
}

export function getSession(sessionId: string) {
  return request<{ state: SessionState }>(`/api/session/${sessionId}`);
}

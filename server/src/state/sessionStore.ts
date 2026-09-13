import type { SessionState } from "./types.js";

/** In-memory store of active sessions, keyed by session id. Fine for a single-process demo server. */
const sessions = new Map<string, SessionState>();

export function saveSession(state: SessionState): SessionState {
  sessions.set(state.id, state);
  return state;
}

export function getSession(id: string): SessionState | undefined {
  return sessions.get(id);
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

import { useState } from "react";
import { TopicSetup } from "./components/TopicSetup";
import { Conversation } from "./components/Conversation";
import { SummaryView } from "./components/SummaryView";
import {
  startSession,
  submitExitCheck,
  submitFollowUpAnswer,
  submitOpeningExplanation,
  submitSignal,
} from "./api/client";
import type { Difficulty, OrchestratorResult, SessionState, SessionSummary, UserSignal } from "./types";

type AppPhase = "setup" | "active" | "summary";

export default function App() {
  const [phase, setPhase] = useState<AppPhase>("setup");
  const [session, setSession] = useState<SessionState | null>(null);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [pendingConcepts, setPendingConcepts] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function applyResult(result: OrchestratorResult) {
    setSession(result.state);
    setPrompt(result.prompt ?? null);
    if (result.summary) {
      setSummary(result.summary);
      setPhase("summary");
    } else {
      setPendingConcepts(result.pendingConcepts ?? null);
    }
  }

  async function guarded(fn: () => Promise<OrchestratorResult>) {
    setBusy(true);
    setError(null);
    try {
      applyResult(await fn());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  function handleStart(topic: string, customCriteria: string, difficulty: Difficulty) {
    void guarded(async () => {
      const result = await startSession(topic, customCriteria, difficulty);
      setPhase("active");
      return result;
    });
  }

  function handleUserUtterance(text: string) {
    if (!session) return;
    void guarded(() =>
      session.phase === "opening" ? submitOpeningExplanation(session.id, text) : submitFollowUpAnswer(session.id, text)
    );
  }

  function handleSignal(signal: UserSignal) {
    if (!session) return;
    void guarded(() => submitSignal(session.id, signal));
  }

  function handleExitCheck(wrapUpAnyway: boolean) {
    if (!session) return;
    void guarded(() => submitExitCheck(session.id, wrapUpAnyway));
  }

  function handleRestart() {
    setSession(null);
    setPrompt(null);
    setSummary(null);
    setPendingConcepts(null);
    setPhase("setup");
  }

  return (
    <div className="app">
      {error && <div className="error-banner">{error}</div>}
      {phase === "setup" && <TopicSetup onStart={handleStart} busy={busy} />}
      {phase === "active" && session && (
        <Conversation
          session={session}
          prompt={prompt}
          pendingConcepts={pendingConcepts}
          busy={busy}
          onUserUtterance={handleUserUtterance}
          onSignal={handleSignal}
          onExitCheck={handleExitCheck}
        />
      )}
      {phase === "summary" && summary && session && (
        <SummaryView topic={session.topic} summary={summary} onRestart={handleRestart} />
      )}
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { useVoicePipeline } from "../speech/useVoicePipeline";
import { TranscriptLog } from "./TranscriptLog";
import { ConceptTracker } from "./ConceptTracker";
import type { SessionState, UserSignal } from "../types";

export interface ConversationProps {
  session: SessionState;
  prompt: string | null;
  pendingConcepts: string[] | null;
  busy: boolean;
  onUserUtterance: (text: string) => void;
  onSignal: (signal: UserSignal) => void;
  onExitCheck: (wrapUpAnyway: boolean) => void;
}

export function Conversation({ session, prompt, pendingConcepts, busy, onUserUtterance, onSignal, onExitCheck }: ConversationProps) {
  const lastPromptRef = useRef<string | null>(null);
  const pipeline = useVoicePipeline({ onFinalTranscript: onUserUtterance });

  // User-controlled mic intent - a manual mute stays muted across turns
  // rather than being silently re-enabled the next time a prompt arrives.
  const [micEnabled, setMicEnabled] = useState(true);

  useEffect(() => {
    if (!prompt || prompt === lastPromptRef.current) return;
    lastPromptRef.current = prompt;
    if (micEnabled) pipeline.startListening();
    // pipeline.startListening is stable across renders (see useVoicePipeline), safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, micEnabled]);

  const activeConcept = session.activeConceptIndex !== null ? session.concepts[session.activeConceptIndex] : null;
  const canRespondByVoice = session.phase === "opening" || session.phase === "followup";
  const isExitCheck = session.phase === "exit-check";

  function toggleMic() {
    const next = !micEnabled;
    setMicEnabled(next);
    if (next) {
      pipeline.startListening();
    } else if (canRespondByVoice) {
      // End the user's turn now and send whatever's been heard so far,
      // instead of silently discarding it.
      pipeline.stopListeningAndSubmit();
    } else {
      pipeline.stopListening();
    }
  }

  return (
    <div className="conversation">
      <div className="conversation-main">
        <h1>
          {session.topic} <span className={`difficulty-badge ${session.difficulty}`}>{session.difficulty}</span>
        </h1>

        {!pipeline.supported && (
          <p className="warn">Speech recognition isn't supported in this browser. Try Chrome or Edge, or type your answer below.</p>
        )}

        <TranscriptLog
          entries={session.transcript}
          interimText={canRespondByVoice && micEnabled ? pipeline.interimText : undefined}
        />

        <div className="mic-status">
          {pipeline.listening && <span className="status-chip listening">Listening…</span>}
          {pipeline.micError && <span className="status-chip warn">Mic error: {pipeline.micError}</span>}
          {busy && <span className="status-chip busy">Thinking…</span>}
        </div>

        <div className="voice-controls">
          <button type="button" onClick={toggleMic} disabled={!pipeline.supported}>
            {micEnabled ? (canRespondByVoice ? "🎤 Stop & send" : "🎤 Stop listening") : "🎤 Start listening"}
          </button>
        </div>

        <TypedFallback disabled={!canRespondByVoice || busy} onSubmit={onUserUtterance} />

        {isExitCheck && pendingConcepts && (
          <div className="exit-check">
            <p>
              {pendingConcepts.length > 0
                ? `A few things are still open: ${pendingConcepts.join(", ")}.`
                : "Everything's been covered."}
            </p>
            <div className="controls">
              <button onClick={() => onExitCheck(false)} disabled={busy}>
                Keep going
              </button>
              <button onClick={() => onExitCheck(true)} disabled={busy}>
                Skip them and wrap up
              </button>
            </div>
          </div>
        )}

        {canRespondByVoice && (
          <div className="controls">
            <button onClick={() => onSignal("not-sure")} disabled={busy || session.phase === "opening"}>
              I'm not sure
            </button>
            <button onClick={() => onSignal("dont-know")} disabled={busy || session.phase === "opening"}>
              I don't know
            </button>
            <button onClick={() => onSignal("understand-topic")} disabled={busy}>
              I understand the topic
            </button>
          </div>
        )}
      </div>

      <ConceptTracker concepts={session.concepts} activeConceptId={activeConcept?.concept.id ?? null} />
    </div>
  );
}

/** Text fallback for browsers without speech support, or noisy environments. */
function TypedFallback({ disabled, onSubmit }: { disabled: boolean; onSubmit: (text: string) => void }) {
  return (
    <form
      className="typed-fallback"
      onSubmit={(e) => {
        e.preventDefault();
        const input = e.currentTarget.elements.namedItem("typed") as HTMLInputElement;
        if (input.value.trim()) {
          onSubmit(input.value.trim());
          input.value = "";
        }
      }}
    >
      <input name="typed" placeholder="Or type your answer..." disabled={disabled} />
      <button type="submit" disabled={disabled}>
        Send
      </button>
    </form>
  );
}

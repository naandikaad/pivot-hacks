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
  const lastSpokenRef = useRef<string | null>(null);
  const pipeline = useVoicePipeline({ onFinalTranscript: onUserUtterance });

  // User-controlled intent, independent of the pipeline's own auto mute/resume
  // around TTS playback - a manual mic toggle would otherwise get silently
  // undone the next time the assistant finishes speaking.
  const [micEnabled, setMicEnabled] = useState(true);
  const micEnabledRef = useRef(micEnabled);
  micEnabledRef.current = micEnabled;

  // Whether the assistant is allowed to speak its responses aloud at all.
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  useEffect(() => {
    if (!prompt || prompt === lastSpokenRef.current) return;
    lastSpokenRef.current = prompt;
    if (voiceEnabled) {
      void pipeline.speak(prompt).then(() => {
        if (!micEnabledRef.current) pipeline.stopListening();
      });
    } else if (micEnabledRef.current) {
      pipeline.startListening();
    }
    // pipeline methods are stable across renders (see useVoicePipeline), safe to omit
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prompt, voiceEnabled]);

  const activeConcept = session.activeConceptIndex !== null ? session.concepts[session.activeConceptIndex] : null;
  const canRespondByVoice = session.phase === "opening" || session.phase === "followup";
  const isExitCheck = session.phase === "exit-check";

  // Plain reads + a single side effect per click, rather than doing the side
  // effect inside a setState updater function - React can invoke updaters
  // more than once (e.g. StrictMode), which would double-submit an answer.
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

  function toggleVoice() {
    const next = !voiceEnabled;
    setVoiceEnabled(next);
    if (!next) pipeline.cancelSpeaking(); // interrupt immediately when turned off
  }

  return (
    <div className="conversation">
      <div className="conversation-main">
        <h1>{session.topic}</h1>

        {!pipeline.supported && (
          <p className="warn">
            Speech recognition/synthesis isn't supported in this browser. Try Chrome or Edge, or type your answer below.
          </p>
        )}

        <TranscriptLog
          entries={session.transcript}
          interimText={canRespondByVoice && micEnabled ? pipeline.interimText : undefined}
        />

        <div className="mic-status">
          {pipeline.speaking && <span className="status-chip speaking">Speaking…</span>}
          {!pipeline.speaking && pipeline.listening && <span className="status-chip listening">Listening…</span>}
          {pipeline.micError && <span className="status-chip warn">Mic error: {pipeline.micError}</span>}
          {pipeline.speechError && <span className="status-chip warn">Voice error: {pipeline.speechError}</span>}
          {busy && <span className="status-chip busy">Thinking…</span>}
        </div>

        <div className="voice-controls">
          <button type="button" onClick={toggleMic} disabled={!pipeline.supported}>
            {micEnabled ? (canRespondByVoice ? "🎤 Stop & send" : "🎤 Stop listening") : "🎤 Start listening"}
          </button>
          <button type="button" onClick={toggleVoice} disabled={!pipeline.supported}>
            {pipeline.speaking ? "⏹ Stop speaking" : voiceEnabled ? "🔊 Voice on" : "🔇 Voice off"}
          </button>
          <button
            type="button"
            onClick={() => void pipeline.speak("This is a test of the assistant's voice.")}
            disabled={!pipeline.supported || pipeline.speaking}
            title="Speaks a short test phrase - use this to check your browser/OS can produce audio at all, independent of the AI"
          >
            🔈 Test voice
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

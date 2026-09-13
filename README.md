# Voice Knowledge Tester

A voice-based Socratic knowledge tester. You pick a topic (optionally pasting your own
rubric), explain what you know out loud, and the app asks gentle follow-up questions to
surface gaps and misconceptions - without ever telling you you're wrong. It ends with a
private study summary that explains *why* each gap was flagged.

## Architecture

Two npm workspaces:

- **`server/`** - Express + TypeScript. Owns the conversation state machine, the five LLM
  prompt templates, and a small JSON-file store for cross-session spaced repetition.
- **`client/`** - Vite + React + TypeScript. Owns the voice pipeline (browser-native STT/TTS)
  and the UI (topic setup, live conversation, concept tracker, summary).

The two only talk over a small JSON HTTP API (`server/src/routes/session.ts`) - there's no
shared code, so either side can be swapped independently (e.g. a React Native client, or a
server backed by a different LLM).

### Conversation state machine

`server/src/state/stateMachine.ts` is pure, LLM-free, and unit tested
(`server/src/test/stateMachine.test.ts`). It models the flow as:

```
setup -> opening (free-form explanation) -> grading -> followup (per-concept loop) -> exit-check? -> summary -> done
```

Each rubric concept tracks its own escalation stage:

```
initial -> open -> narrow -> hint1 -> hint2 -> hint3 -> resolved | gave-up
```

- A normal answer that still shows a gap advances one rung.
- "I'm not sure" fast-forwards straight into (or deeper into) the hint ladder.
- "I don't know" jumps straight to `gave-up` and moves on - no more probing on that concept.
- Every third gap concept is marked for "explain it back to me" (Feynman) framing instead of a
  direct question.

`server/src/session/orchestrator.ts` is the thin layer that calls the LLM prompt templates and
feeds their output back into the state machine - it's the only place the two are connected.

### LLM prompt templates

Five separate templates under `server/src/llm/prompts/`, each independently testable via
`npm run manual:<name> --workspace server` (requires `ANTHROPIC_API_KEY`):

| Template | File | Purpose |
|---|---|---|
| (a) Rubric parsing | `parseRubric.ts` | Normalizes a pasted rubric *or* generates one from a bare topic into the same `Concept[]` shape |
| (b) Grading | `gradeResponse.ts` | Classifies an explanation (opening or follow-up) as confirmed/partial/missing/contradicted |
| (c) Follow-up questions | `generateFollowUp.ts` | Open clarification, narrowed question, or Feynman prompt - never reveals the gap |
| (d) Hints | `generateHint.ts` | Three escalating hint levels (vague nudge -> named concept -> near-answer) |
| (e) Study summary | `generateSummary.ts` | The one place direct language is used - explains *why* each gap was flagged, tied to what the user actually said |

All five validate their output against a zod schema (`server/src/llm/schemas.ts`) via
`callClaudeJSON`, which retries once if the model's JSON doesn't parse/validate.

### Spaced repetition

`server/src/storage/persistentStore.ts` is a JSON-file store keyed by topic. At the end of
every session, every concept's final status is upserted by label. At the start of the next
session on the same topic, any concept still `missing` / `contradicted` / `hint-resolved` is
prepended to the rubric with `isReview: true` - so it naturally gets asked before new material,
framed conversationally rather than as a called-out past failure.

### Voice pipeline

`client/src/speech/` defines `SpeechInputProvider` / `SpeechOutputProvider` interfaces so the
rest of the app never talks to a specific engine. The bundled implementations
(`webSpeechInput.ts`, `webSpeechOutput.ts`) use the browser's native Web Speech API:

- Continuous recognition with streamed interim results shown live as the user talks; a turn is
  only ever finalized and submitted by the explicit "Stop & send" button, never on a pause -
  the user decides when they're done, not a timeout.
- `useVoicePipeline` handles turn-taking: the mic is muted while the assistant is speaking and
  resumed automatically once playback ends.
- A typed-text fallback is always available (unsupported browsers, noisy environments).

Swap in a streaming provider (Deepgram, ElevenLabs, etc.) by implementing the two interfaces -
no other file needs to change.

## Running it

Requires Node 20+.

```bash
npm install

# terminal 1
export ANTHROPIC_API_KEY=sk-ant-...
npm run dev:server        # http://localhost:8787

# terminal 2
npm run dev:client        # http://localhost:5173
```

Speech recognition/synthesis require a Chromium-based browser (Chrome/Edge) - Safari and
Firefox support is inconsistent, and the app falls back to a typed-text input automatically.

### Testing

```bash
npm run test:server                              # state machine + persistent store unit tests
npm run manual:parseRubric --workspace server     # exercise one prompt template in isolation
npm run manual:gradeResponse --workspace server
npm run manual:followUp --workspace server
npm run manual:hint --workspace server
npm run manual:summary --workspace server
```

The manual scripts call the real Anthropic API and print the raw JSON output, so each prompt
template can be tuned and verified independently of the full conversation flow.

import { nanoid } from "nanoid";
import type {
  Concept,
  ConceptStageT,
  ConceptStatusT,
  ConceptTrack,
  ConceptTrackEntry,
  SessionState,
} from "./types.js";

/**
 * Pure, LLM-free session state machine. Every function here takes a state and
 * plain data (already-decided grading results, user signals) and returns the
 * next state. Nothing in this file calls out to a model, so it can be unit
 * tested deterministically; the orchestration layer (routes/session.ts) is
 * responsible for calling the LLM prompt templates and feeding their output
 * back in here.
 */

const HINT_LADDER: ConceptStageT[] = ["open", "narrow", "hint1", "hint2", "hint3"];

export function createSession(
  topic: string,
  concepts: Concept[],
  rubricSource: "custom" | "generated"
): SessionState {
  return {
    id: nanoid(),
    topic,
    rubricSource,
    createdAt: Date.now(),
    phase: "opening",
    concepts: concepts.map((concept) => ({
      concept,
      status: "unconfirmed",
      stage: "initial",
      hintCount: 0,
      attempts: 0,
      usedFeynman: false,
      history: [],
    })),
    activeConceptIndex: null,
    transcript: [],
    feynmanCounter: 0,
  };
}

function appendTranscript(state: SessionState, entry: ConceptTrackEntry): SessionState {
  return { ...state, transcript: [...state.transcript, entry] };
}

function updateConceptTrack(
  state: SessionState,
  index: number,
  patch: Partial<ConceptTrack>
): SessionState {
  const concepts = state.concepts.slice();
  concepts[index] = { ...concepts[index], ...patch };
  return { ...state, concepts };
}

function appendConceptHistory(
  state: SessionState,
  index: number,
  entry: ConceptTrackEntry
): SessionState {
  const track = state.concepts[index];
  return updateConceptTrack(state, index, { history: [...track.history, entry] });
}

/** Records the user's free-form opening explanation in the shared transcript. */
export function recordOpeningExplanation(state: SessionState, text: string): SessionState {
  return appendTranscript(state, { role: "user", text, kind: "answer" });
}

export interface ConceptGradeResult {
  conceptId: string;
  status: ConceptStatusT;
  rationale?: string;
}

/**
 * Applies the grading-prompt output for the user's opening explanation
 * against every rubric concept at once, then figures out where to go next:
 * straight to a follow-up on the first gap, or to the summary if everything
 * was already confirmed.
 */
export function applyInitialGrading(
  state: SessionState,
  results: ConceptGradeResult[]
): SessionState {
  let next = state;
  for (const result of results) {
    const index = next.concepts.findIndex((c) => c.concept.id === result.conceptId);
    if (index === -1) continue;
    const resolvedStage: ConceptStageT = result.status === "confirmed" ? "resolved" : "initial";
    next = updateConceptTrack(next, index, {
      status: result.status,
      stage: resolvedStage,
      attempts: next.concepts[index].attempts + 1,
    });
  }
  return advanceToNextGapOrFinish(next);
}

/** First concept that still needs attention: not confirmed, not resolved, not given up on. */
export function selectNextGapIndex(state: SessionState): number | null {
  const idx = state.concepts.findIndex(
    (c) => c.stage !== "resolved" && c.stage !== "gave-up" && c.status !== "confirmed"
  );
  return idx === -1 ? null : idx;
}

export function getPendingConcepts(state: SessionState): ConceptTrack[] {
  return state.concepts.filter((c) => c.stage !== "resolved" && c.stage !== "gave-up");
}

/**
 * Moves the active pointer to the next gap concept and decides whether that
 * concept's opening question should use "explain it back to me" (Feynman)
 * framing -- every third gap encountered in a session gets the Feynman
 * treatment, per the product spec's "periodically" instruction.
 */
export function advanceToNextGapOrFinish(state: SessionState): SessionState {
  const idx = selectNextGapIndex(state);
  if (idx === null) {
    return { ...state, activeConceptIndex: null, phase: "summary" };
  }
  const feynmanCounter = state.feynmanCounter + 1;
  const useFeynman = feynmanCounter % 3 === 0;
  let next = updateConceptTrack(state, idx, {
    stage: "open",
    usedFeynman: useFeynman,
  });
  next = { ...next, activeConceptIndex: idx, phase: "followup", feynmanCounter };
  return next;
}

/** Appends an assistant question/hint to both the global transcript and the concept's own history. */
export function recordAssistantPrompt(
  state: SessionState,
  text: string,
  kind: "question" | "hint" | "feynman-prompt"
): SessionState {
  if (state.activeConceptIndex === null) return appendTranscript(state, { role: "assistant", text, kind });
  let next = appendTranscript(state, { role: "assistant", text, kind });
  next = appendConceptHistory(next, state.activeConceptIndex, { role: "assistant", text, kind });
  return next;
}

/** Appends the user's answer to a follow-up question/hint. */
export function recordFollowUpAnswer(state: SessionState, text: string): SessionState {
  if (state.activeConceptIndex === null) return appendTranscript(state, { role: "user", text, kind: "answer" });
  let next = appendTranscript(state, { role: "user", text, kind: "answer" });
  next = appendConceptHistory(next, state.activeConceptIndex, { role: "user", text, kind: "answer" });
  return next;
}

function nextStageInLadder(stage: ConceptStageT): ConceptStageT {
  const i = HINT_LADDER.indexOf(stage);
  if (i === -1 || i === HINT_LADDER.length - 1) return "gave-up";
  return HINT_LADDER[i + 1];
}

/**
 * Applies the grading-prompt output for an answer given during follow-up on
 * the currently active concept. If the answer resolves the gap, moves on to
 * the next one; otherwise escalates one rung up the open -> narrow -> hint1
 * -> hint2 -> hint3 -> gave-up ladder.
 */
export function applyFollowUpGrading(
  state: SessionState,
  status: ConceptStatusT
): SessionState {
  if (state.activeConceptIndex === null) return state;
  const idx = state.activeConceptIndex;
  const track = state.concepts[idx];
  const attempts = track.attempts + 1;

  if (status === "confirmed") {
    const finalStatus: ConceptStatusT = track.hintCount > 0 ? "hint-resolved" : "confirmed";
    const withStatus = updateConceptTrack(state, idx, {
      status: finalStatus,
      stage: "resolved",
      attempts,
    });
    return advanceToNextGapOrFinish(withStatus);
  }

  const nextStage = nextStageInLadder(track.stage);
  const hintCount = nextStage.startsWith("hint") ? track.hintCount + 1 : track.hintCount;
  const withStatus = updateConceptTrack(state, idx, { status, attempts, hintCount });

  if (nextStage === "gave-up") {
    const gaveUp = updateConceptTrack(withStatus, idx, { stage: "gave-up" });
    return advanceToNextGapOrFinish(gaveUp);
  }

  return updateConceptTrack(withStatus, idx, { stage: nextStage });
}

export type UserSignal = "not-sure" | "dont-know" | "understand-topic";

/**
 * Handles the three control buttons. "not-sure" fast-forwards to the next
 * hint (or gives up if hints are exhausted); "dont-know" stops probing this
 * concept immediately and routes it to the study summary; "understand-topic"
 * requests an early exit, which the caller must reconcile against
 * getPendingConcepts() before actually ending the session.
 */
export function applyUserSignal(state: SessionState, signal: UserSignal): SessionState {
  if (signal === "understand-topic") {
    return { ...state, phase: "exit-check" };
  }

  if (state.activeConceptIndex === null) return state;
  const idx = state.activeConceptIndex;
  const track = state.concepts[idx];

  if (signal === "dont-know") {
    const gaveUp = updateConceptTrack(state, idx, { stage: "gave-up" });
    return advanceToNextGapOrFinish(gaveUp);
  }

  // "not-sure": jump forward into (or deeper into) the hint ladder.
  const nextStage = track.stage.startsWith("hint")
    ? nextStageInLadder(track.stage)
    : "hint1";
  const hintCount = nextStage.startsWith("hint") ? track.hintCount + 1 : track.hintCount;

  if (nextStage === "gave-up") {
    const gaveUp = updateConceptTrack(state, idx, { stage: "gave-up", hintCount });
    return advanceToNextGapOrFinish(gaveUp);
  }

  return updateConceptTrack(state, idx, { stage: nextStage, hintCount });
}

/**
 * Resolves the "exit-check" phase triggered by the "I understand the topic"
 * button. `wrapUpAnyway` marks every still-open concept as skipped and moves
 * to the summary; otherwise the session resumes exactly where it left off.
 */
export function resolveExitCheck(state: SessionState, wrapUpAnyway: boolean): SessionState {
  if (!wrapUpAnyway) {
    return { ...state, phase: state.activeConceptIndex === null ? "opening" : "followup" };
  }
  let next = state;
  next.concepts.forEach((c, i) => {
    if (c.stage !== "resolved" && c.stage !== "gave-up") {
      next = updateConceptTrack(next, i, { stage: "gave-up" });
    }
  });
  return { ...next, activeConceptIndex: null, phase: "summary" };
}

export function markDone(state: SessionState): SessionState {
  return { ...state, phase: "done" };
}

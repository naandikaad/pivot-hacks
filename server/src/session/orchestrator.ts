import { nanoid } from "nanoid";
import { parseRubric } from "../llm/prompts/parseRubric.js";
import { gradeInitialExplanation, gradeFollowUpAnswer } from "../llm/prompts/gradeResponse.js";
import { generateFollowUp } from "../llm/prompts/generateFollowUp.js";
import { generateHint } from "../llm/prompts/generateHint.js";
import { generateSummary } from "../llm/prompts/generateSummary.js";
import { getReviewConcepts, recordSessionOutcome } from "../storage/persistentStore.js";
import {
  applyFollowUpGrading,
  applyInitialGrading,
  applyUserSignal,
  createSession,
  recordAssistantPrompt,
  recordFollowUpAnswer,
  recordOpeningExplanation,
  resolveExitCheck,
  type UserSignal,
} from "../state/stateMachine.js";
import type { Concept, ConceptTrackEntry, SessionState } from "../state/types.js";
import type { SummaryOutput } from "../llm/schemas.js";

export interface StartSessionInput {
  topic: string;
  customCriteria?: string;
}

export interface OrchestratorResult {
  state: SessionState;
  prompt?: string;
  summary?: SummaryOutput;
  pendingConcepts?: string[];
}

const OPENING_LINE = (topic: string) =>
  `Let's talk about ${topic}. Go ahead and explain everything you know about it - I'll just listen for now.`;

export async function startSession({ topic, customCriteria }: StartSessionInput): Promise<OrchestratorResult> {
  const rubric = await parseRubric({ topic, customCriteria });
  const generatedConcepts: Concept[] = rubric.concepts.map((c) => ({
    id: nanoid(),
    label: c.label,
    description: c.description,
    isReview: false,
  }));

  // Review concepts from prior sessions on this topic go first, per the
  // spaced-repetition requirement that weak areas resurface before new material.
  const reviewConcepts = getReviewConcepts(topic, 3);
  const concepts = [...reviewConcepts, ...generatedConcepts];

  const state = createSession(topic, concepts, customCriteria ? "custom" : "generated");
  const opening = OPENING_LINE(topic);
  // Record it into the transcript too, not just return it for TTS - otherwise
  // a user whose browser silently blocks speech synthesis sees an empty chat
  // log with no indication of what to do.
  const withOpening = recordAssistantPrompt(state, opening, "question");
  return { state: withOpening, prompt: opening };
}

function priorQuestionsFor(entries: ConceptTrackEntry[]): string[] {
  return entries.filter((e) => e.role === "assistant" && (e.kind === "question" || e.kind === "feynman-prompt")).map((e) => e.text);
}

/**
 * After any transition that leaves the state machine in "followup" with an
 * active concept awaiting its next spoken prompt, this generates that prompt
 * (a question, a Feynman invitation, or a hint - decided purely from the
 * concept's current stage) and records it into the transcript.
 */
async function producePromptForCurrentStage(state: SessionState): Promise<OrchestratorResult> {
  if (state.phase !== "followup" || state.activeConceptIndex === null) {
    return { state };
  }
  const track = state.concepts[state.activeConceptIndex];

  if (track.stage === "hint1" || track.stage === "hint2" || track.stage === "hint3") {
    const hintLevel = Number(track.stage.slice(-1)) as 1 | 2 | 3;
    const { hint } = await generateHint({
      topic: state.topic,
      concept: track.concept,
      hintLevel,
      history: track.history,
    });
    const next = recordAssistantPrompt(state, hint, "hint");
    return { state: next, prompt: hint };
  }

  const stage = track.stage === "narrow" ? "narrow" : "open";
  const useFeynman = track.usedFeynman && track.stage === "open";
  const { question } = await generateFollowUp({
    topic: state.topic,
    concept: track.concept,
    stage,
    useFeynman,
    priorQuestions: priorQuestionsFor(track.history),
  });
  const kind = useFeynman ? "feynman-prompt" : "question";
  const next = recordAssistantPrompt(state, question, kind);
  return { state: next, prompt: question };
}

async function finalizeSummary(state: SessionState): Promise<OrchestratorResult> {
  const summary = await generateSummary({ topic: state.topic, concepts: state.concepts });
  recordSessionOutcome(state.topic, state.concepts);
  return { state: { ...state, phase: "done" }, summary };
}

/** Drives the state forward from wherever it is until it lands on something the user must respond to. */
async function settle(state: SessionState): Promise<OrchestratorResult> {
  if (state.phase === "summary") return finalizeSummary(state);
  if (state.phase === "followup") return producePromptForCurrentStage(state);
  return { state };
}

export async function submitOpeningExplanation(state: SessionState, text: string): Promise<OrchestratorResult> {
  const withAnswer = recordOpeningExplanation(state, text);
  const graded = await gradeInitialExplanation({
    topic: state.topic,
    concepts: state.concepts.map((c) => c.concept),
    userExplanation: text,
  });
  const next = applyInitialGrading(withAnswer, graded.grades);
  return settle(next);
}

export async function submitFollowUpAnswer(state: SessionState, text: string): Promise<OrchestratorResult> {
  if (state.activeConceptIndex === null) return { state };
  const track = state.concepts[state.activeConceptIndex];
  const lastQuestion = [...track.history].reverse().find((e) => e.role === "assistant")?.text ?? "";

  const withAnswer = recordFollowUpAnswer(state, text);
  const { status } = await gradeFollowUpAnswer({
    topic: state.topic,
    concept: track.concept,
    questionAsked: lastQuestion,
    userAnswer: text,
  });
  const next = applyFollowUpGrading(withAnswer, status);
  return settle(next);
}

export async function submitSignal(state: SessionState, signal: UserSignal): Promise<OrchestratorResult> {
  const next = applyUserSignal(state, signal);
  if (next.phase === "exit-check") {
    return { state: next, pendingConcepts: next.concepts.filter((c) => c.stage !== "resolved" && c.stage !== "gave-up").map((c) => c.concept.label) };
  }
  return settle(next);
}

export async function submitExitCheck(state: SessionState, wrapUpAnyway: boolean): Promise<OrchestratorResult> {
  const next = resolveExitCheck(state, wrapUpAnyway);
  return settle(next);
}

import { z } from "zod";

/**
 * A single testable idea pulled out of a rubric (custom-pasted or AI-generated).
 * Both rubric sources normalize into this same shape so grading/follow-up logic
 * never needs to branch on where the concept came from.
 */
export const ConceptSchema = z.object({
  id: z.string(),
  label: z.string(),
  description: z.string(),
  /** Review concepts are weak spots resurfaced from a prior session (spaced repetition). */
  isReview: z.boolean().default(false),
});
export type Concept = z.infer<typeof ConceptSchema>;

export const ConceptStatus = z.enum([
  "unconfirmed",
  "confirmed",
  "partial",
  "missing",
  "contradicted",
  "hint-resolved",
]);
export type ConceptStatusT = z.infer<typeof ConceptStatus>;

/** Chosen once at session setup; calibrates how easy/hard the generated rubric and follow-up questions are. */
export const Difficulty = z.enum(["beginner", "advanced"]);
export type DifficultyT = z.infer<typeof Difficulty>;

/** Where a concept sits in the escalation ladder described in the product spec. */
export const ConceptStage = z.enum([
  "initial", // not yet asked about directly
  "open", // open clarification question in flight
  "narrow", // narrowed question in flight
  "hint1",
  "hint2",
  "hint3",
  "resolved",
  "gave-up", // user said "I don't know" or exhausted hints without success
]);
export type ConceptStageT = z.infer<typeof ConceptStage>;

export interface ConceptTrackEntry {
  role: "assistant" | "user";
  text: string;
  kind?: "question" | "hint" | "answer" | "feynman-prompt";
}

export interface ConceptTrack {
  concept: Concept;
  status: ConceptStatusT;
  stage: ConceptStageT;
  hintCount: number;
  /** How many times this concept has been graded (initial pass counts as one). */
  attempts: number;
  usedFeynman: boolean;
  history: ConceptTrackEntry[];
  /** Populated once a concept is graded as missing/contradicted and the user gives up on it. */
  misconceptionNote?: string;
}

export const SessionPhase = z.enum([
  "setup",
  "opening", // waiting for the user's free-form explanation
  "grading",
  "followup",
  "exit-check",
  "summary",
  "done",
]);
export type SessionPhaseT = z.infer<typeof SessionPhase>;

export interface SessionState {
  id: string;
  topic: string;
  rubricSource: "custom" | "generated";
  difficulty: DifficultyT;
  createdAt: number;
  phase: SessionPhaseT;
  concepts: ConceptTrack[];
  /** Index into concepts[] of the concept currently being followed up on. */
  activeConceptIndex: number | null;
  transcript: ConceptTrackEntry[];
  feynmanCounter: number;
}

// ---- Persistent cross-session store (spaced repetition) ----

export const PersistedConceptSchema = z.object({
  label: z.string(),
  description: z.string(),
  status: ConceptStatus,
  hintCount: z.number(),
  lastSeen: z.number(),
});
export type PersistedConcept = z.infer<typeof PersistedConceptSchema>;

export const PersistedTopicSchema = z.object({
  topic: z.string(),
  concepts: z.array(PersistedConceptSchema),
});
export type PersistedTopic = z.infer<typeof PersistedTopicSchema>;

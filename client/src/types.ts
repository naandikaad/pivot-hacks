// Mirrors server/src/state/types.ts's client-visible shape. Kept as a plain
// duplicate (no shared package) since this is a two-workspace demo app; if
// this grows, promote it to a shared workspace package instead.

export type ConceptStatus = "unconfirmed" | "confirmed" | "partial" | "missing" | "contradicted" | "hint-resolved";

export type ConceptStage = "initial" | "open" | "narrow" | "hint1" | "hint2" | "hint3" | "resolved" | "gave-up";

export interface Concept {
  id: string;
  label: string;
  description: string;
  isReview: boolean;
}

export interface ConceptTrackEntry {
  role: "assistant" | "user";
  text: string;
  kind?: "question" | "hint" | "answer" | "feynman-prompt";
}

export interface ConceptTrack {
  concept: Concept;
  status: ConceptStatus;
  stage: ConceptStage;
  hintCount: number;
  attempts: number;
  usedFeynman: boolean;
  history: ConceptTrackEntry[];
  misconceptionNote?: string;
}

export type SessionPhase = "setup" | "opening" | "grading" | "followup" | "exit-check" | "summary" | "done";

export interface SessionState {
  id: string;
  topic: string;
  rubricSource: "custom" | "generated";
  createdAt: number;
  phase: SessionPhase;
  concepts: ConceptTrack[];
  activeConceptIndex: number | null;
  transcript: ConceptTrackEntry[];
  feynmanCounter: number;
}

export interface SummaryConcept {
  label: string;
  status: ConceptStatus;
  note: string;
}

export interface SessionSummary {
  headline: string;
  concepts: SummaryConcept[];
}

export interface OrchestratorResult {
  state: SessionState;
  prompt?: string;
  summary?: SessionSummary;
  pendingConcepts?: string[];
}

export type UserSignal = "not-sure" | "dont-know" | "understand-topic";

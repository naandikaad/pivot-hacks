import { callClaudeJSON } from "../client.js";
import { SummarySchema, type SummaryOutput } from "../schemas.js";
import type { ConceptTrack } from "../../state/types.js";

/**
 * Generates the end-of-session study summary. This is the one place direct,
 * factual language about gaps is appropriate (per product spec) - it's a
 * private recap, not a live spoken judgment - so the tone rules here are
 * deliberately different from the follow-up/hint templates: explain *why*
 * each gap was flagged, tying it back to the specific misconception the user
 * showed, not just "you missed X".
 */

const SYSTEM = `You are writing a private, end-of-session study summary - tutor's notes, not a pass/fail report. This is the only point in the app where direct, factual language about gaps is appropriate, since the user will read it privately after the conversation.

For each concept:
- If confirmed (with or without a hint): a brief, warm affirmation. If a hint was needed, note that plainly but positively (e.g. "you got there with a nudge toward X").
- If missing/partial/contradicted and the user said "I don't know" or ran out of hints: explain plainly what they said (quote or closely paraphrase it), how it diverges from the correct concept, and *why* that suggests a specific misconception - not just "you missed X" but "you described X as [their version], which suggests confusion with [actual concept] because [reason]".
- Concepts surfaced via an "explain it back to me" (Feynman) prompt are a higher-confidence signal of a real gap - reflect that in how definitively you describe the gap, but keep the tone matter-of-fact, not alarming.
- Never use shaming language ("failed", "you got this wrong", disappointment). State facts plainly and constructively.

Write a one-sentence warm, non-judgmental headline summarizing overall performance before the per-concept notes.`;

export interface GenerateSummaryInput {
  topic: string;
  concepts: ConceptTrack[];
}

export function buildSummaryPrompt({ topic, concepts }: GenerateSummaryInput): string {
  const blocks = concepts.map((c) => {
    const transcript = c.history.length
      ? c.history.map((h) => `  ${h.role}: ${h.text}`).join("\n")
      : "  (not discussed beyond the opening explanation)";
    return [
      `Concept: ${c.concept.label} - ${c.concept.description}`,
      `Final status: ${c.status}`,
      `Hints used: ${c.hintCount}`,
      `Surfaced via explain-it-back (Feynman) prompt: ${c.usedFeynman}`,
      `Review item from a prior session: ${c.concept.isReview}`,
      `Conversation about this concept:`,
      transcript,
    ].join("\n");
  });

  return [`Topic: ${topic}`, ``, `Per-concept detail:`, ``, blocks.join("\n\n")].join("\n");
}

export async function generateSummary(input: GenerateSummaryInput): Promise<SummaryOutput> {
  return callClaudeJSON({
    system: SYSTEM,
    prompt: buildSummaryPrompt(input),
    schema: SummarySchema,
    maxTokens: 2048,
  });
}

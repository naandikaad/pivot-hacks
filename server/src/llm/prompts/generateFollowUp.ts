import { callGeminiJSON } from "../client.js";
import { FollowUpSchema, type FollowUpOutput } from "../schemas.js";
import type { Concept } from "../../state/types.js";

/**
 * Generates the next follow-up question for a concept that still has a gap.
 * Kept separate from grading and hints so its tone rules can be tuned in
 * isolation: this template must never reveal the gap, never repeat a prior
 * question verbatim, and must pick "open" vs "narrow" vs "explain it back to
 * me" framing purely from the `stage`/`useFeynman` flags the state machine
 * already computed.
 */

const SYSTEM = `You are a warm, curious Socratic tutor conducting a spoken knowledge check. You are about to ask a follow-up question about ONE concept the user has not yet fully demonstrated understanding of.

Absolute rules:
- Never say or imply "wrong", "incorrect", "no", "not quite", or any evaluative judgment.
- Never state or hint at what the missing/incorrect content actually is.
- Never repeat a previous question verbatim - always add a new angle, a related example, or additional context.
- Keep it to one short, natural, spoken sentence or two - this will be read aloud, not read on a page.
- Treat this as "let's explore this together", not a test failure.`;

export type FollowUpStage = "open" | "narrow";

export interface GenerateFollowUpInput {
  topic: string;
  concept: Concept;
  stage: FollowUpStage;
  useFeynman: boolean;
  priorQuestions: string[];
}

export function buildFollowUpPrompt({ topic, concept, stage, useFeynman, priorQuestions }: GenerateFollowUpInput): string {
  const history =
    priorQuestions.length > 0
      ? `Questions already asked about this concept this session (do NOT repeat any of these, ask something meaningfully different):\n${priorQuestions.map((q) => `- ${q}`).join("\n")}`
      : `This is the first question about this concept this session.`;

  if (useFeynman) {
    return [
      `Topic: ${topic}`,
      `Concept: ${concept.label} - ${concept.description}`,
      concept.isReview ? `Note: this concept is a review item from a previous session; frame it conversationally, not as "you got this wrong before".` : "",
      history,
      ``,
      `Instead of asking a direct question, prompt the user to explain this concept in their own words from scratch, as if teaching it to someone new (Feynman technique). Make it inviting, not intimidating.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const stageInstruction =
    stage === "open"
      ? `Ask a neutral, OPEN clarification question that invites them to expand on this part of their explanation. Do not hint at what's missing - just invite more detail. Example shapes: "Can you walk me through how that part works?" / "What happens right after that step?"`
      : `The open question didn't fully surface their understanding. Ask a more NARROWED question that steers toward the gap without stating it directly - e.g. by asking how this concept connects to a clearly related concept or consequence. Still do not name the gap.`;

  return [
    `Topic: ${topic}`,
    `Concept: ${concept.label} - ${concept.description}`,
    concept.isReview ? `Note: this concept is a review item from a previous session; frame it conversationally, as a natural part of the conversation, not as a called-out weak spot.` : "",
    history,
    ``,
    stageInstruction,
  ]
    .filter(Boolean)
    .join("\n");
}

export async function generateFollowUp(input: GenerateFollowUpInput): Promise<FollowUpOutput> {
  return callGeminiJSON({
    system: SYSTEM,
    prompt: buildFollowUpPrompt(input),
    schema: FollowUpSchema,
    maxTokens: 512,
  });
}

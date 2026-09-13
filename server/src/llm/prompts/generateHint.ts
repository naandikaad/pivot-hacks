import { callGeminiJSON } from "../client.js";
import { HintSchema, type HintOutput } from "../schemas.js";
import type { Concept, ConceptTrackEntry } from "../../state/types.js";

/**
 * Generates escalating hints (up to 3 per concept). Separate template from
 * follow-up questions because the tone and information-density rules are
 * different: a hint is allowed to progressively narrow toward the answer,
 * where a plain follow-up question never may.
 */

const SYSTEM = `You are a warm, encouraging Socratic tutor giving a spoken hint. You must never say or imply "wrong", "incorrect", "no", or "not quite" - the user has just said they're not sure, which is a completely normal part of learning.

Hint levels (you will be told which one to produce):
1. A vague nudge - point at the general area or category the answer lives in, without naming the concept itself.
2. A more specific nudge - name the relevant related concept or relationship, but do not state the answer.
3. A near-answer - walk them right up to the conclusion so they can complete the last small step themselves.

Keep it to one or two short spoken sentences.`;

export interface GenerateHintInput {
  topic: string;
  concept: Concept;
  hintLevel: 1 | 2 | 3;
  history: ConceptTrackEntry[];
}

export function buildHintPrompt({ topic, concept, hintLevel, history }: GenerateHintInput): string {
  const transcript =
    history.length > 0
      ? `Conversation so far about this concept:\n${history.map((h) => `${h.role}: ${h.text}`).join("\n")}`
      : `No conversation about this concept yet.`;

  return [
    `Topic: ${topic}`,
    `Concept: ${concept.label} - ${concept.description}`,
    transcript,
    ``,
    `Produce a level ${hintLevel} hint (1 = vague nudge, 2 = specific nudge naming the related concept, 3 = near-answer).`,
  ].join("\n");
}

export async function generateHint(input: GenerateHintInput): Promise<HintOutput> {
  return callGeminiJSON({
    system: SYSTEM,
    prompt: buildHintPrompt(input),
    schema: HintSchema,
    maxTokens: 512,
  });
}

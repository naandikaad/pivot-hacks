import { callGeminiJSON } from "../client.js";
import { RubricSchema, type RubricOutput } from "../schemas.js";

/**
 * Normalizes either a user-pasted criteria/rubric blob or a bare topic name
 * into the same concept-list shape. This is the one place rubric source
 * matters; everything downstream (grading, follow-ups, hints, summary)
 * only ever sees the normalized Concept[] and never needs to branch on
 * where it came from.
 */
export interface ParseRubricInput {
  topic: string;
  customCriteria?: string;
}

const SYSTEM = `You are an expert curriculum designer helping build a spoken knowledge-testing session.
Your job is to produce a normalized list of discrete, testable concepts for a topic.

Rules:
- Each concept must be independently checkable: a listener could confirm or deny understanding of it on its own.
- Keep the list focused: 4-10 concepts for a generated outline, or one concept per distinct idea in a custom rubric (don't invent extra ones, don't drop any).
- Descriptions should state what correct understanding looks like, not just restate the label.
- Order concepts in a sensible teaching order (foundational ideas first).`;

export function buildParseRubricPrompt({ topic, customCriteria }: ParseRubricInput): string {
  if (customCriteria && customCriteria.trim().length > 0) {
    return [
      `Topic: ${topic}`,
      ``,
      `The user pasted the following criteria/rubric describing what needs to be known. Normalize it into the concept-list JSON shape. Preserve every distinct requirement as its own concept; merge only exact duplicates; do not add concepts that aren't implied by the text.`,
      ``,
      `--- USER CRITERIA ---`,
      customCriteria,
      `--- END CRITERIA ---`,
    ].join("\n");
  }
  return [
    `Topic: ${topic}`,
    ``,
    `No custom criteria was provided. Generate a general-purpose outline of the concepts someone should understand about this topic, suitable for testing spoken understanding.`,
  ].join("\n");
}

export async function parseRubric(input: ParseRubricInput): Promise<RubricOutput> {
  return callGeminiJSON({
    system: SYSTEM,
    prompt: buildParseRubricPrompt(input),
    schema: RubricSchema,
  });
}

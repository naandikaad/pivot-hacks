import { callClaudeJSON } from "../client.js";
import { RubricSchema, type RubricOutput } from "../schemas.js";
import type { DifficultyT } from "../../state/types.js";

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
  difficulty: DifficultyT;
}

const SYSTEM = `You are an expert curriculum designer helping build a spoken knowledge-testing session.
Your job is to produce a normalized list of discrete, testable concepts for a topic.

Rules:
- Each concept must be independently checkable: a listener could confirm or deny understanding of it on its own.
- Keep the list focused: 4-10 concepts for a generated outline, or one concept per distinct idea in a custom rubric (don't invent extra ones, don't drop any).
- Descriptions should state what correct understanding looks like, not just restate the label.
- Order concepts in a sensible teaching order (foundational ideas first).`;

const DIFFICULTY_INSTRUCTIONS: Record<DifficultyT, string> = {
  beginner:
    "The user selected BEGINNER difficulty. Favor foundational, introductory-level concepts: core definitions, the basic mechanism or process, and the most common/obvious facts. Avoid edge cases, exceptions, or highly technical nuance. Descriptions should use plain language a newcomer would understand.",
  advanced:
    "The user selected ADVANCED difficulty. Favor deeper, more nuanced concepts: edge cases, exceptions, underlying mechanisms/causes, how the idea connects to or is distinguished from related concepts, and places where common intuition is wrong. Assume the user already knows the basics - don't waste a concept slot on something a beginner course would cover in its first lesson.",
};

export function buildParseRubricPrompt({ topic, customCriteria, difficulty }: ParseRubricInput): string {
  const difficultyNote = DIFFICULTY_INSTRUCTIONS[difficulty];

  if (customCriteria && customCriteria.trim().length > 0) {
    return [
      `Topic: ${topic}`,
      `Difficulty: ${difficulty}`,
      ``,
      `The user pasted the following criteria/rubric describing what needs to be known. Normalize it into the concept-list JSON shape. Preserve every distinct requirement as its own concept; merge only exact duplicates; do not add concepts that aren't implied by the text - the pasted criteria define WHAT is tested, regardless of difficulty.`,
      `${difficultyNote} Use the difficulty level only to calibrate how deep, technical, or plain-language each concept's description should be - never to add or drop concepts the user's criteria didn't ask for.`,
      ``,
      `--- USER CRITERIA ---`,
      customCriteria,
      `--- END CRITERIA ---`,
    ].join("\n");
  }
  return [
    `Topic: ${topic}`,
    `Difficulty: ${difficulty}`,
    ``,
    `No custom criteria was provided. Generate a general-purpose outline of the concepts someone should understand about this topic, suitable for testing spoken understanding.`,
    difficultyNote,
  ].join("\n");
}

export async function parseRubric(input: ParseRubricInput): Promise<RubricOutput> {
  return callClaudeJSON({
    system: SYSTEM,
    prompt: buildParseRubricPrompt(input),
    schema: RubricSchema,
  });
}

import { z } from "zod";
import { callGeminiJSON } from "../client.js";
import { GradingResultSchema, type GradingResult } from "../schemas.js";
import { ConceptStatus, type Concept } from "../../state/types.js";

/**
 * Grades the user's spoken response against the rubric. Two entry points
 * share one system prompt and classification rubric so grading is consistent
 * whether it's evaluating the sprawling opening explanation against every
 * concept at once, or a single focused follow-up answer against the one
 * concept currently being probed.
 */

const SYSTEM = `You are grading a spoken explanation against a knowledge rubric. For each concept, classify the user's understanding as exactly one of:
- "confirmed": they clearly and correctly demonstrated understanding of this concept.
- "partial": they touched on it but left out important detail or nuance.
- "missing": they did not address this concept at all.
- "contradicted": they addressed it but described something inconsistent with the correct concept (a misconception).

Be generous with phrasing and terminology - grade the underlying understanding, not exact wording. Never grade based on tone or confidence, only correctness and completeness of content.`;

export interface GradeInitialInput {
  topic: string;
  concepts: Concept[];
  userExplanation: string;
}

export function buildGradeInitialPrompt({ topic, concepts, userExplanation }: GradeInitialInput): string {
  const conceptList = concepts
    .map((c) => `- id: ${c.id} | label: ${c.label} | what correct understanding looks like: ${c.description}`)
    .join("\n");
  return [
    `Topic: ${topic}`,
    ``,
    `Rubric concepts:`,
    conceptList,
    ``,
    `The user was asked to explain everything they know about the topic. Their full response:`,
    `"""${userExplanation}"""`,
    ``,
    `Return a grade for every concept id listed above, even ones they didn't mention (those are "missing").`,
  ].join("\n");
}

export async function gradeInitialExplanation(input: GradeInitialInput): Promise<GradingResult> {
  return callGeminiJSON({
    system: SYSTEM,
    prompt: buildGradeInitialPrompt(input),
    schema: GradingResultSchema,
  });
}

export const FollowUpGradeSchema = z.object({
  status: ConceptStatus,
  rationale: z.string(),
});
export type FollowUpGrade = z.infer<typeof FollowUpGradeSchema>;

export interface GradeFollowUpInput {
  topic: string;
  concept: Concept;
  questionAsked: string;
  userAnswer: string;
}

export function buildGradeFollowUpPrompt({ topic, concept, questionAsked, userAnswer }: GradeFollowUpInput): string {
  return [
    `Topic: ${topic}`,
    ``,
    `Concept being probed - label: ${concept.label} | what correct understanding looks like: ${concept.description}`,
    ``,
    `Question/prompt the user was just asked:`,
    `"""${questionAsked}"""`,
    ``,
    `User's answer:`,
    `"""${userAnswer}"""`,
    ``,
    `Classify the user's understanding of this one concept given this answer.`,
  ].join("\n");
}

export async function gradeFollowUpAnswer(input: GradeFollowUpInput): Promise<FollowUpGrade> {
  return callGeminiJSON({
    system: SYSTEM,
    prompt: buildGradeFollowUpPrompt(input),
    schema: FollowUpGradeSchema,
  });
}

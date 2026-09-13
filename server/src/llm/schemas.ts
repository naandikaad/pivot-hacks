import { z } from "zod";
import { ConceptStatus } from "../state/types.js";

// ---- (a) rubric parsing / generation ----

export const ParsedConceptSchema = z.object({
  label: z.string().describe("Short name of the concept, e.g. 'Krebs cycle location'"),
  description: z
    .string()
    .describe("One or two sentences describing exactly what a correct understanding looks like"),
});

export const RubricSchema = z.object({
  concepts: z.array(ParsedConceptSchema).min(1).max(12),
});
export type RubricOutput = z.infer<typeof RubricSchema>;

// ---- (b) grading ----

export const ConceptGradeSchema = z.object({
  conceptId: z.string(),
  status: ConceptStatus,
  rationale: z.string().describe("One sentence on why this status was chosen, citing what the user said"),
});

export const GradingResultSchema = z.object({
  grades: z.array(ConceptGradeSchema),
});
export type GradingResult = z.infer<typeof GradingResultSchema>;

// ---- (c) follow-up question generation ----

export const FollowUpSchema = z.object({
  question: z.string().describe("The next spoken question or Feynman-style prompt, in a warm conversational tone"),
});
export type FollowUpOutput = z.infer<typeof FollowUpSchema>;

// ---- (d) hint generation ----

export const HintSchema = z.object({
  hint: z.string().describe("The hint text, spoken tone, calibrated to the requested escalation level"),
});
export type HintOutput = z.infer<typeof HintSchema>;

// ---- (e) end-of-session summary ----

export const SummaryConceptSchema = z.object({
  label: z.string(),
  status: ConceptStatus,
  note: z
    .string()
    .describe(
      "Tutor's-notes style explanation. For gaps: what the user said, how it diverges from the correct concept, and why that suggests a specific misconception. For confirmed concepts: a brief affirmation."
    ),
});

export const SummarySchema = z.object({
  headline: z.string().describe("One warm, non-judgmental sentence summarizing overall performance"),
  concepts: z.array(SummaryConceptSchema),
});
export type SummaryOutput = z.infer<typeof SummarySchema>;

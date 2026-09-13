import Anthropic from "@anthropic-ai/sdk";
import type { z } from "zod";

const client = new Anthropic();

export const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-opus-5";

export interface LLMCallOptions {
  system: string;
  prompt: string;
  maxTokens?: number;
}

/** Plain-text completion, used only where no structured output is needed. */
export async function callClaude({ system, prompt, maxTokens = 1024 }: LLMCallOptions): Promise<string> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: maxTokens,
    system,
    messages: [{ role: "user", content: prompt }],
  });
  const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
  return textBlock?.text ?? "";
}

export interface LLMJSONCallOptions<T> extends LLMCallOptions {
  schema: z.ZodType<T>;
}

/**
 * Requests JSON-shaped output and validates it against a zod schema, retrying
 * once with the validation error fed back to the model if parsing fails.
 * Every prompt template in ./prompts uses this so grading/question/hint/summary
 * output always arrives as typed data the state machine can consume directly.
 */
export async function callClaudeJSON<T>({
  system,
  prompt,
  schema,
  maxTokens = 1536,
}: LLMJSONCallOptions<T>): Promise<T> {
  const jsonSystem = `${system}\n\nRespond with ONLY a single valid JSON object matching the requested shape. No markdown fences, no commentary before or after.`;

  const attempt = async (extra?: string): Promise<T> => {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: maxTokens,
      system: jsonSystem,
      messages: [{ role: "user", content: extra ? `${prompt}\n\n${extra}` : prompt }],
    });
    const textBlock = response.content.find((b): b is Anthropic.TextBlock => b.type === "text");
    const raw = (textBlock?.text ?? "").trim();
    const jsonText = extractJson(raw);
    const parsed = JSON.parse(jsonText);
    return schema.parse(parsed);
  };

  try {
    return await attempt();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return attempt(
      `Your previous response could not be parsed/validated (${message}). Reply again with ONLY valid JSON matching the required shape.`
    );
  }
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) return fenced[1].trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) return text.slice(start, end + 1);
  return text;
}

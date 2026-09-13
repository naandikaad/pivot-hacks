import { Router } from "express";
import { z } from "zod";
import { getSession, saveSession } from "../state/sessionStore.js";
import {
  startSession,
  submitExitCheck,
  submitFollowUpAnswer,
  submitOpeningExplanation,
  submitSignal,
} from "../session/orchestrator.js";
import type { OrchestratorResult } from "../session/orchestrator.js";

export const sessionRouter = Router();

function respond(res: import("express").Response, result: OrchestratorResult) {
  saveSession(result.state);
  res.json(result);
}

const StartSchema = z.object({
  topic: z.string().min(1),
  customCriteria: z.string().optional(),
  difficulty: z.enum(["beginner", "advanced"]),
});

sessionRouter.post("/", async (req, res, next) => {
  try {
    const input = StartSchema.parse(req.body);
    const result = await startSession(input);
    respond(res, result);
  } catch (err) {
    next(err);
  }
});

sessionRouter.get("/:id", (req, res) => {
  const state = getSession(req.params.id);
  if (!state) return res.status(404).json({ error: "session not found" });
  res.json({ state });
});

const TextSchema = z.object({ text: z.string().min(1) });

sessionRouter.post("/:id/explain", async (req, res, next) => {
  try {
    const state = getSession(req.params.id);
    if (!state) return res.status(404).json({ error: "session not found" });
    if (state.phase !== "opening") return res.status(409).json({ error: `session is in phase ${state.phase}, not opening` });
    const { text } = TextSchema.parse(req.body);
    const result = await submitOpeningExplanation(state, text);
    respond(res, result);
  } catch (err) {
    next(err);
  }
});

sessionRouter.post("/:id/answer", async (req, res, next) => {
  try {
    const state = getSession(req.params.id);
    if (!state) return res.status(404).json({ error: "session not found" });
    if (state.phase !== "followup") return res.status(409).json({ error: `session is in phase ${state.phase}, not followup` });
    const { text } = TextSchema.parse(req.body);
    const result = await submitFollowUpAnswer(state, text);
    respond(res, result);
  } catch (err) {
    next(err);
  }
});

const SignalSchema = z.object({ signal: z.enum(["not-sure", "dont-know", "understand-topic"]) });

sessionRouter.post("/:id/signal", async (req, res, next) => {
  try {
    const state = getSession(req.params.id);
    if (!state) return res.status(404).json({ error: "session not found" });
    const { signal } = SignalSchema.parse(req.body);
    const result = await submitSignal(state, signal);
    respond(res, result);
  } catch (err) {
    next(err);
  }
});

const ExitCheckSchema = z.object({ wrapUpAnyway: z.boolean() });

sessionRouter.post("/:id/exit-check", async (req, res, next) => {
  try {
    const state = getSession(req.params.id);
    if (!state) return res.status(404).json({ error: "session not found" });
    if (state.phase !== "exit-check") return res.status(409).json({ error: `session is in phase ${state.phase}, not exit-check` });
    const { wrapUpAnyway } = ExitCheckSchema.parse(req.body);
    const result = await submitExitCheck(state, wrapUpAnyway);
    respond(res, result);
  } catch (err) {
    next(err);
  }
});

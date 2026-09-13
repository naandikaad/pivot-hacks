import { Router } from "express";
import { z } from "zod";

export const ttsRouter = Router();

const TtsSchema = z.object({ text: z.string().min(1).max(2000) });

// "Rachel" - a stock ElevenLabs premade voice, used as a sane default so the
// app works out of the box; override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
// Flash is ElevenLabs' lowest-latency model (~75ms) - matches this app's
// real-time conversation use case better than the higher-quality/slower
// models. Override with ELEVENLABS_MODEL_ID if quality matters more here.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";

/**
 * Proxies text-to-speech through ElevenLabs so the API key never reaches the
 * browser. Buffers the full response before replying (simpler and more
 * robust than piping a stream through Express) - fine for the short,
 * one-or-two-sentence utterances this app ever sends.
 */
ttsRouter.post("/", async (req, res, next) => {
  try {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      return res.status(503).json({ error: "ELEVENLABS_API_KEY is not configured on the server" });
    }
    const { text } = TtsSchema.parse(req.body);

    const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: MODEL_ID,
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      return res.status(upstream.status || 502).json({ error: `ElevenLabs TTS request failed: ${detail || upstream.statusText}` });
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    res.setHeader("Content-Type", upstream.headers.get("content-type") ?? "audio/mpeg");
    res.send(audio);
  } catch (err) {
    next(err);
  }
});

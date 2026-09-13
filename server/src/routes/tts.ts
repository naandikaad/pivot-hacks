import { Router } from "express";
import { z } from "zod";
import { googleTtsProvider } from "../tts/googleTtsProvider.js";
import { elevenLabsProvider } from "../tts/elevenLabsProvider.js";
import { TtsConfigError, TtsUpstreamError, type TtsProvider } from "../tts/types.js";

export const ttsRouter = Router();

const TtsSchema = z.object({ text: z.string().min(1).max(2000) });

const PROVIDERS: Record<string, TtsProvider> = {
  google: googleTtsProvider,
  elevenlabs: elevenLabsProvider,
};

// Google Cloud TTS is the default - it has a generous free tier, unlike
// ElevenLabs which is paid from the first request. Set
// TTS_PROVIDER=elevenlabs (plus ELEVENLABS_API_KEY) to switch back; both
// providers speak the exact same {audio, contentType} contract, so nothing
// else in the app needs to change either way.
const PROVIDER_NAME = (process.env.TTS_PROVIDER ?? "google").toLowerCase();
const provider = PROVIDERS[PROVIDER_NAME];

ttsRouter.post("/", async (req, res, next) => {
  try {
    if (!provider) {
      return res
        .status(500)
        .json({ error: `Unknown TTS_PROVIDER "${PROVIDER_NAME}" - expected one of: ${Object.keys(PROVIDERS).join(", ")}` });
    }
    const { text } = TtsSchema.parse(req.body);
    const { audio, contentType } = await provider.synthesize(text);
    res.setHeader("Content-Type", contentType);
    res.send(audio);
  } catch (err) {
    if (err instanceof TtsConfigError) return res.status(503).json({ error: err.message });
    if (err instanceof TtsUpstreamError) return res.status(502).json({ error: err.message });
    next(err);
  }
});

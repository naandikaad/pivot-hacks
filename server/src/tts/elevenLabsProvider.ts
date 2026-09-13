import { TtsConfigError, TtsUpstreamError, type TtsProvider, type TtsResult } from "./types.js";

// "Rachel" - a stock ElevenLabs premade voice, used as a sane default so the
// app works out of the box; override with ELEVENLABS_VOICE_ID.
const VOICE_ID = process.env.ELEVENLABS_VOICE_ID ?? "21m00Tcm4TlvDq8ikWAM";
// Flash is ElevenLabs' lowest-latency model (~75ms) - matches this app's
// real-time conversation use case better than the higher-quality/slower
// models. Override with ELEVENLABS_MODEL_ID if quality matters more here.
const MODEL_ID = process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5";

/**
 * TTS via ElevenLabs. Not the default provider (see routes/tts.ts) since it
 * has no meaningful free tier, but kept fully working and one env var
 * (TTS_PROVIDER=elevenlabs) away from being active again.
 */
export const elevenLabsProvider: TtsProvider = {
  async synthesize(text: string): Promise<TtsResult> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new TtsConfigError("ELEVENLABS_API_KEY is not configured on the server");
    }

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
      throw new TtsUpstreamError(`ElevenLabs TTS request failed: ${detail || upstream.statusText}`);
    }

    const audio = Buffer.from(await upstream.arrayBuffer());
    return { audio, contentType: upstream.headers.get("content-type") ?? "audio/mpeg" };
  },
};

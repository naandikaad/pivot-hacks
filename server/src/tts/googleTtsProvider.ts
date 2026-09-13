import { TtsConfigError, TtsUpstreamError, type TtsProvider, type TtsResult } from "./types.js";

// A Neural2 voice - broadly available on any GCP project with the Cloud
// Text-to-Speech API enabled, no special access needed. Override
// GOOGLE_TTS_VOICE to use a newer Chirp 3: HD voice (e.g.
// "en-US-Chirp3-HD-Kore") if your project has access to it.
const VOICE_NAME = process.env.GOOGLE_TTS_VOICE ?? "en-US-Neural2-C";
const LANGUAGE_CODE = process.env.GOOGLE_TTS_LANGUAGE_CODE ?? "en-US";

/**
 * TTS via Google Cloud Text-to-Speech, using simple API-key auth (a query
 * param) rather than a service account - much less setup for a small app
 * like this one. Get a key from Google Cloud Console with the "Cloud
 * Text-to-Speech API" enabled, and set it as GOOGLE_TTS_API_KEY.
 */
export const googleTtsProvider: TtsProvider = {
  async synthesize(text: string): Promise<TtsResult> {
    const apiKey = process.env.GOOGLE_TTS_API_KEY;
    if (!apiKey) {
      throw new TtsConfigError("GOOGLE_TTS_API_KEY is not configured on the server");
    }

    const upstream = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        input: { text },
        voice: { languageCode: LANGUAGE_CODE, name: VOICE_NAME },
        audioConfig: { audioEncoding: "MP3" },
      }),
    });

    if (!upstream.ok) {
      const detail = await upstream.text().catch(() => "");
      throw new TtsUpstreamError(`Google Cloud TTS request failed: ${detail || upstream.statusText}`);
    }

    const body = (await upstream.json()) as { audioContent?: string };
    if (!body.audioContent) {
      throw new TtsUpstreamError("Google Cloud TTS response did not include audioContent");
    }

    return { audio: Buffer.from(body.audioContent, "base64"), contentType: "audio/mpeg" };
  },
};

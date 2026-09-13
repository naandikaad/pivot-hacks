import type { SpeechOutputProvider } from "./types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8787";

// A single, page-lifetime <audio> element reused for every utterance, rather
// than a fresh one per speak() call. Reusing one already-"unlocked" element
// is what lets audio triggered asynchronously later (e.g. after a fetch
// resolves) actually autoplay - see unlockAudioPlayback() below.
const sharedAudio: HTMLAudioElement | null = typeof Audio !== "undefined" ? new Audio() : null;

// A real (not zero-length) 10ms silent 8kHz/8-bit mono WAV, played once
// during a genuine user gesture purely to satisfy the browser's autoplay
// policy for this element for the rest of the page's lifetime. Verified
// structurally valid (correct RIFF/fmt/data header fields, non-empty PCM
// data) rather than assumed from a copied snippet.
const SILENT_WAV =
  "data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA==";

export function unlockAudioPlayback(): void {
  if (!sharedAudio) return;
  try {
    sharedAudio.src = SILENT_WAV;
    void sharedAudio.play().catch(() => {
      // Some browsers still refuse a zero-content clip - harmless either way,
      // this is best-effort priming, not a hard requirement.
    });
  } catch {
    // best-effort priming only
  }
}

/**
 * TTS via ElevenLabs, proxied through this app's server (POST /api/tts) so
 * the ElevenLabs API key never reaches the browser. Implements the same
 * SpeechOutputProvider interface as WebSpeechOutput, so it's a drop-in swap -
 * see useVoicePipeline's createOutput option. Carries over the same
 * hardening: a safety-net timeout so a stuck request/playback can never hang
 * the conversation forever, and real errors surfaced via onError rather than
 * swallowed.
 */
export class ElevenLabsOutput implements SpeechOutputProvider {
  private audio = sharedAudio ?? new Audio();
  private speakingCb: ((speaking: boolean) => void) | null = null;
  private errorCb: ((message: string) => void) | null = null;
  /** Resolves whichever speak() call is currently in flight - lets cancel() end it immediately. */
  private activeSettle: (() => void) | null = null;

  isSupported(): boolean {
    return typeof Audio !== "undefined" && typeof fetch !== "undefined";
  }

  speak(text: string): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();

    return new Promise((resolve) => {
      let settled = false;
      let objectUrl: string | null = null;

      const settle = () => {
        if (settled) return;
        settled = true;
        if (this.activeSettle === settle) this.activeSettle = null;
        this.speakingCb?.(false);
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        resolve();
      };
      this.activeSettle = settle;

      // Scaled to text length, floor 10s - guarantees this never hangs the
      // conversation forever even if the request or playback gets stuck.
      const timeoutMs = Math.max(10000, text.length * 120);
      const timer = setTimeout(() => {
        if (settled) return;
        this.errorCb?.("ElevenLabs TTS timed out");
        settle();
      }, timeoutMs);

      fetch(`${BASE_URL}/api/tts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
        .then(async (res) => {
          if (!res.ok) {
            const body = await res.json().catch(() => ({}));
            throw new Error(body.error ?? `TTS request failed: ${res.status}`);
          }
          return res.blob();
        })
        .then((blob) => {
          if (settled) return; // cancel() already fired while the fetch was in flight
          objectUrl = URL.createObjectURL(blob);
          this.audio.src = objectUrl;
          this.audio.onplay = () => this.speakingCb?.(true);
          this.audio.onended = () => {
            clearTimeout(timer);
            settle();
          };
          this.audio.onerror = () => {
            clearTimeout(timer);
            this.errorCb?.("Audio playback failed");
            settle();
          };
          return this.audio.play();
        })
        .catch((err) => {
          clearTimeout(timer);
          if (!settled) {
            this.errorCb?.(err instanceof Error ? err.message : String(err));
            settle();
          }
        });
    });
  }

  cancel(): void {
    this.audio.pause();
    this.activeSettle?.();
  }

  onSpeakingChange(cb: (speaking: boolean) => void): void {
    this.speakingCb = cb;
  }

  onError(cb: (message: string) => void): void {
    this.errorCb = cb;
  }
}

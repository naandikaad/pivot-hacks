import type { SpeechOutputProvider } from "./types";

/**
 * Browser-native TTS via the SpeechSynthesis API. Works around several
 * long-standing quirks that otherwise make the assistant silently fail to
 * speak with no error surfaced anywhere:
 *  1. Calling speak() immediately after cancel() can get silently dropped -
 *     a short delay between them avoids it.
 *  2. speak() calls made asynchronously (e.g. after a fetch resolves, as
 *     every real prompt here is) can be silently ignored unless the engine
 *     was already "unlocked" by a speak() call made synchronously inside an
 *     earlier user gesture - see unlockSpeechSynthesis() below.
 *  3. If the browser/OS has no TTS voices installed at all, some
 *     implementations never fire onstart/onend/onerror for a speak() call -
 *     without a timeout that hangs the whole conversation forever with zero
 *     feedback. A safety-net timer guarantees this always resolves and
 *     always reports something.
 */
export class WebSpeechOutput implements SpeechOutputProvider {
  private speakingCb: ((speaking: boolean) => void) | null = null;
  private errorCb: ((message: string) => void) | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();
    const synth = window.speechSynthesis;

    return new Promise((resolve) => {
      let settled = false;
      const settle = () => {
        if (settled) return;
        settled = true;
        this.speakingCb?.(false);
        resolve();
      };

      const startSpeaking = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        const voice = pickVoice(synth);
        if (voice) utterance.voice = voice;

        let started = false;
        utterance.onstart = () => {
          started = true;
          this.speakingCb?.(true);
        };
        utterance.onend = settle;
        utterance.onerror = (event) => {
          // "canceled"/"interrupted" fire on our own cancel()/replace calls above - expected, not real errors.
          if (event.error !== "canceled" && event.error !== "interrupted") {
            this.errorCb?.(event.error);
          }
          settle();
        };

        synth.speak(utterance);

        // Safety net: some browsers/OSes silently never fire any event at all
        // (most often because no TTS voice is installed) - guarantee we still
        // report *something* and hand the turn back instead of hanging forever.
        const timeoutMs = Math.max(8000, text.length * 100);
        setTimeout(() => {
          if (settled) return;
          if (!started) this.errorCb?.("speech synthesis timed out - no voice available?");
          settle();
        }, timeoutMs);
      };

      if (synth.speaking || synth.pending) {
        synth.cancel();
        setTimeout(startSpeaking, 60);
      } else {
        startSpeaking();
      }
    });
  }

  cancel(): void {
    if (this.isSupported() && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel();
    }
    this.speakingCb?.(false);
  }

  onSpeakingChange(cb: (speaking: boolean) => void): void {
    this.speakingCb = cb;
  }

  onError(cb: (message: string) => void): void {
    this.errorCb = cb;
  }
}

function pickVoice(synth: SpeechSynthesis): SpeechSynthesisVoice | null {
  const voices = synth.getVoices();
  if (voices.length === 0) return null;
  return voices.find((v) => v.lang?.startsWith("en") && v.default) ?? voices.find((v) => v.lang?.startsWith("en")) ?? voices[0];
}

/**
 * Chrome only reliably allows speech synthesis when the *first* speak() call
 * on a page happens synchronously within a user gesture. Every real prompt
 * here is spoken later from an async effect (after a fetch resolves), which
 * Chrome can silently ignore unless the engine was already "primed" earlier.
 * Call this directly from the click handler that starts a session.
 */
export function unlockSpeechSynthesis(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(""));
  } catch {
    // best-effort priming only
  }
}

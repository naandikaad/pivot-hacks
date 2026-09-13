import type { SpeechOutputProvider } from "./types";

/**
 * Browser-native TTS via the SpeechSynthesis API. Works around two
 * long-standing Chrome quirks that otherwise make the assistant silently
 * fail to speak with no error surfaced anywhere:
 *  1. Calling speak() immediately after cancel() can get silently dropped -
 *     a short delay between them avoids it.
 *  2. speak() calls made asynchronously (e.g. after a fetch resolves, as
 *     every real prompt here is) can be silently ignored unless the engine
 *     was already "unlocked" by a speak() call made synchronously inside an
 *     earlier user gesture - see unlockSpeechSynthesis() below.
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
      const startSpeaking = () => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.0;
        utterance.onstart = () => this.speakingCb?.(true);
        const finish = () => {
          this.speakingCb?.(false);
          resolve();
        };
        utterance.onend = finish;
        utterance.onerror = (event) => {
          // "canceled"/"interrupted" fire on our own cancel()/replace calls below - expected, not real errors.
          if (event.error !== "canceled" && event.error !== "interrupted") {
            this.errorCb?.(event.error);
          }
          finish();
        };
        synth.speak(utterance);
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

import type { SpeechInputProvider } from "./types";

/**
 * Browser-native STT via the Web Speech API. Runs continuous recognition
 * with interim results streamed live for on-screen feedback, and treats a
 * period of silence after the last result as end-of-turn - a simple stand-in
 * for real voice-activity detection until a streaming provider is wired in.
 */
export class WebSpeechInput implements SpeechInputProvider {
  private recognition: SpeechRecognition | null = null;
  private resultCb: ((text: string, isFinal: boolean) => void) | null = null;
  private speechStartCb: (() => void) | null = null;
  private errorCb: ((message: string) => void) | null = null;
  private finalTranscript = "";
  /** The most recent not-yet-final chunk, kept so a manual stop() can still submit it. */
  private lastInterim = "";
  private silenceTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldRestart = false;
  private readonly silenceMs: number;

  constructor(silenceMs = 1400) {
    this.silenceMs = silenceMs;
  }

  isSupported(): boolean {
    return typeof window !== "undefined" && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  }

  private createRecognition(): SpeechRecognition {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) throw new Error("SpeechRecognition is not supported in this browser");
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          this.finalTranscript += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      this.lastInterim = interim;
      this.resultCb?.(`${this.finalTranscript}${interim}`.trim(), false);
      this.resetSilenceTimer();
    };

    recognition.onspeechstart = () => this.speechStartCb?.();
    recognition.onerror = (event) => {
      // "no-speech" fires constantly during normal pauses - not a real error.
      if (event.error !== "no-speech") this.errorCb?.(event.error);
    };
    recognition.onend = () => {
      if (this.shouldRestart) {
        try {
          recognition.start();
        } catch {
          // already starting; ignore
        }
      }
    };

    return recognition;
  }

  private resetSilenceTimer() {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.silenceTimer = setTimeout(() => this.finalizeTurn(), this.silenceMs);
  }

  private finalizeTurn() {
    const text = `${this.finalTranscript}${this.lastInterim}`.trim();
    this.finalTranscript = "";
    this.lastInterim = "";
    if (text.length > 0) {
      this.resultCb?.(text, true);
    }
  }

  start(): void {
    if (this.recognition) return;
    this.shouldRestart = true;
    this.finalTranscript = "";
    this.lastInterim = "";
    this.recognition = this.createRecognition();
    this.recognition.start();
  }

  stop(): void {
    this.shouldRestart = false;
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.recognition?.stop();
    this.recognition = null;
  }

  /**
   * Stops recognition immediately and, unlike stop(), submits whatever has
   * been heard so far - even a still-interim chunk that hasn't been
   * finalized by the recognizer yet. Used when the user explicitly ends
   * their turn (the "Stop listening" button) instead of waiting out the
   * silence timeout.
   */
  stopAndSubmit(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer);
    this.finalizeTurn();
    this.stop();
  }

  onResult(cb: (text: string, isFinal: boolean) => void): void {
    this.resultCb = cb;
  }

  onSpeechStart(cb: () => void): void {
    this.speechStartCb = cb;
  }

  onError(cb: (message: string) => void): void {
    this.errorCb = cb;
  }
}

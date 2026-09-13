import type { SpeechInputProvider } from "./types";

/**
 * Browser-native STT via the Web Speech API. Runs continuous recognition
 * with interim results streamed live for on-screen feedback. A turn is only
 * ever finalized and submitted explicitly via stopAndSubmit() (the "Stop &
 * send" button) - there is no silence-timeout auto-submit, so a pause never
 * sends an answer before the user is ready.
 */
export class WebSpeechInput implements SpeechInputProvider {
  private recognition: SpeechRecognition | null = null;
  private resultCb: ((text: string, isFinal: boolean) => void) | null = null;
  private speechStartCb: (() => void) | null = null;
  private errorCb: ((message: string) => void) | null = null;
  private finalTranscript = "";
  /** The most recent not-yet-final chunk, kept so stopAndSubmit() can still submit it. */
  private lastInterim = "";
  private shouldRestart = false;

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
    this.recognition?.stop();
    this.recognition = null;
  }

  /**
   * Stops recognition immediately and submits whatever has been heard so
   * far - even a still-interim chunk that hasn't been finalized by the
   * recognizer yet. This is the only way a turn ever gets submitted.
   */
  stopAndSubmit(): void {
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

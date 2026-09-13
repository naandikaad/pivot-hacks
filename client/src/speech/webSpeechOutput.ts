import type { SpeechOutputProvider } from "./types";

/** Browser-native TTS via the SpeechSynthesis API. */
export class WebSpeechOutput implements SpeechOutputProvider {
  private speakingCb: ((speaking: boolean) => void) | null = null;

  isSupported(): boolean {
    return typeof window !== "undefined" && "speechSynthesis" in window;
  }

  speak(text: string): Promise<void> {
    if (!this.isSupported()) return Promise.resolve();
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.onstart = () => this.speakingCb?.(true);
      const finish = () => {
        this.speakingCb?.(false);
        resolve();
      };
      utterance.onend = finish;
      utterance.onerror = finish;
      window.speechSynthesis.speak(utterance);
    });
  }

  cancel(): void {
    if (this.isSupported()) window.speechSynthesis.cancel();
    this.speakingCb?.(false);
  }

  onSpeakingChange(cb: (speaking: boolean) => void): void {
    this.speakingCb = cb;
  }
}

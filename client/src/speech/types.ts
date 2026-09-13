/**
 * Provider interfaces for speech input (STT) and output (TTS). The rest of
 * the app only talks to these interfaces, never to a specific engine - the
 * Web Speech API implementations here (webSpeechInput/webSpeechOutput) can
 * be swapped for a streaming provider (Deepgram, ElevenLabs, etc.) later
 * without touching useVoicePipeline or any component.
 */

export interface SpeechInputProvider {
  isSupported(): boolean;
  start(): void;
  /** Stops recognition without submitting whatever's been heard so far (e.g. muting for TTS playback). */
  stop(): void;
  /** Stops recognition and submits whatever's been heard so far, even if not yet finalized by silence. */
  stopAndSubmit(): void;
  /** Fires on every recognition update; `isFinal` marks end-of-turn (silence detected, or a manual stopAndSubmit()). */
  onResult(cb: (text: string, isFinal: boolean) => void): void;
  /** Fires when the engine detects the user has started talking (used to interrupt playback). */
  onSpeechStart(cb: () => void): void;
  onError(cb: (message: string) => void): void;
}

export interface SpeechOutputProvider {
  isSupported(): boolean;
  /** Resolves once the utterance has finished playing (or immediately if cancelled). */
  speak(text: string): Promise<void>;
  cancel(): void;
  onSpeakingChange(cb: (speaking: boolean) => void): void;
  /** Fires on a real synthesis failure (not on our own cancel()/interrupt calls). */
  onError(cb: (message: string) => void): void;
}

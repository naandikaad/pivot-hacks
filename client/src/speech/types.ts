/**
 * Provider interface for speech input (STT). The rest of the app only talks
 * to this interface, never to a specific engine - the Web Speech API
 * implementation here (webSpeechInput.ts) could be swapped for a streaming
 * provider (Deepgram, etc.) later without touching useVoicePipeline or any
 * component. The assistant's side of the conversation is text-only; there is
 * no speech output provider.
 */

export interface SpeechInputProvider {
  isSupported(): boolean;
  start(): void;
  /** Stops recognition without submitting whatever's been heard so far. */
  stop(): void;
  /** Stops recognition and submits whatever's been heard so far - the only way a turn is ever finalized. */
  stopAndSubmit(): void;
  /** Fires on every recognition update; `isFinal` is only ever true after a stopAndSubmit() call. */
  onResult(cb: (text: string, isFinal: boolean) => void): void;
  /** Fires when the engine detects the user has started talking. */
  onSpeechStart(cb: () => void): void;
  onError(cb: (message: string) => void): void;
}

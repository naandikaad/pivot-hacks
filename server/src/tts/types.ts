export interface TtsResult {
  audio: Buffer;
  contentType: string;
}

export interface TtsProvider {
  synthesize(text: string): Promise<TtsResult>;
}

/** Thrown when a provider's required env vars aren't set - the route reports this as 503. */
export class TtsConfigError extends Error {}

/** Thrown when the upstream TTS API itself rejects the request - the route reports this as 502. */
export class TtsUpstreamError extends Error {}

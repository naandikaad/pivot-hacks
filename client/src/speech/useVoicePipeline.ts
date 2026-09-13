import { useCallback, useEffect, useRef, useState } from "react";
import { WebSpeechInput } from "./webSpeechInput";
import type { SpeechInputProvider } from "./types";

export interface UseVoicePipelineOptions {
  onFinalTranscript: (text: string) => void;
  /** Swap in a different STT implementation (e.g. a streaming provider) without touching callers. */
  createInput?: () => SpeechInputProvider;
}

export interface VoicePipeline {
  supported: boolean;
  listening: boolean;
  interimText: string;
  micError: string | null;
  startListening: () => void;
  /** Mutes the mic without submitting anything. */
  stopListening: () => void;
  /** Ends the user's turn immediately, submitting whatever's been heard so far as their answer. */
  stopListeningAndSubmit: () => void;
}

export function useVoicePipeline({ onFinalTranscript, createInput }: UseVoicePipelineOptions): VoicePipeline {
  const inputRef = useRef<SpeechInputProvider | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    const input = createInput ? createInput() : new WebSpeechInput();
    inputRef.current = input;
    setSupported(input.isSupported());

    input.onResult((text, isFinal) => {
      if (isFinal) {
        setInterimText("");
        onFinalTranscriptRef.current(text);
      } else {
        setInterimText(text);
      }
    });
    input.onError((message) => setMicError(message));

    return () => {
      input.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startListening = useCallback(() => {
    setMicError(null);
    inputRef.current?.start();
    setListening(true);
  }, []);

  const stopListening = useCallback(() => {
    inputRef.current?.stop();
    setListening(false);
  }, []);

  const stopListeningAndSubmit = useCallback(() => {
    setInterimText("");
    inputRef.current?.stopAndSubmit();
    setListening(false);
  }, []);

  return {
    supported,
    listening,
    interimText,
    micError,
    startListening,
    stopListening,
    stopListeningAndSubmit,
  };
}

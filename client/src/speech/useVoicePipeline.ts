import { useCallback, useEffect, useRef, useState } from "react";
import { WebSpeechInput } from "./webSpeechInput";
import { WebSpeechOutput } from "./webSpeechOutput";
import type { SpeechInputProvider, SpeechOutputProvider } from "./types";

export interface UseVoicePipelineOptions {
  onFinalTranscript: (text: string) => void;
  /** Swap in a different STT/TTS implementation (e.g. a streaming provider) without touching callers. */
  createInput?: () => SpeechInputProvider;
  createOutput?: () => SpeechOutputProvider;
}

export interface VoicePipeline {
  supported: boolean;
  listening: boolean;
  speaking: boolean;
  interimText: string;
  micError: string | null;
  /** Speaks text, muting the mic first and resuming listening once done (natural turn-taking). */
  speak: (text: string) => Promise<void>;
  /** Interrupts any in-progress speech immediately and hands the turn back to the mic. */
  cancelSpeaking: () => void;
  startListening: () => void;
  /** Mutes the mic without submitting anything (used internally while the assistant speaks). */
  stopListening: () => void;
  /** Ends the user's turn immediately, submitting whatever's been heard so far as their answer. */
  stopListeningAndSubmit: () => void;
}

export function useVoicePipeline({ onFinalTranscript, createInput, createOutput }: UseVoicePipelineOptions): VoicePipeline {
  const inputRef = useRef<SpeechInputProvider | null>(null);
  const outputRef = useRef<SpeechOutputProvider | null>(null);
  const onFinalTranscriptRef = useRef(onFinalTranscript);
  onFinalTranscriptRef.current = onFinalTranscript;

  const [supported, setSupported] = useState(true);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [micError, setMicError] = useState<string | null>(null);

  useEffect(() => {
    const input = createInput ? createInput() : new WebSpeechInput();
    const output = createOutput ? createOutput() : new WebSpeechOutput();
    inputRef.current = input;
    outputRef.current = output;
    setSupported(input.isSupported() && output.isSupported());

    input.onResult((text, isFinal) => {
      if (isFinal) {
        setInterimText("");
        onFinalTranscriptRef.current(text);
      } else {
        setInterimText(text);
      }
    });
    input.onError((message) => setMicError(message));
    output.onSpeakingChange(setSpeaking);

    return () => {
      input.stop();
      output.cancel();
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

  const speak = useCallback(
    async (text: string) => {
      stopListening(); // mute the mic while the assistant talks, avoids self-transcription
      await outputRef.current?.speak(text);
      startListening(); // hand the turn back to the user
    },
    [startListening, stopListening]
  );

  const cancelSpeaking = useCallback(() => {
    // Triggers the output's onSpeakingChange(false) and resolves the pending
    // speak() promise, which itself calls startListening() - no need to duplicate that here.
    outputRef.current?.cancel();
  }, []);

  return {
    supported,
    listening,
    speaking,
    interimText,
    micError,
    speak,
    cancelSpeaking,
    startListening,
    stopListening,
    stopListeningAndSubmit,
  };
}

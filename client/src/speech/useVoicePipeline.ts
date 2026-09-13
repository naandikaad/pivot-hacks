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
  startListening: () => void;
  stopListening: () => void;
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

  const speak = useCallback(
    async (text: string) => {
      stopListening(); // mute the mic while the assistant talks, avoids self-transcription
      await outputRef.current?.speak(text);
      startListening(); // hand the turn back to the user
    },
    [startListening, stopListening]
  );

  return { supported, listening, speaking, interimText, micError, speak, startListening, stopListening };
}

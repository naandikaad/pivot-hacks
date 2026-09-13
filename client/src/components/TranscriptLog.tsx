import { useEffect, useRef } from "react";
import type { ConceptTrackEntry } from "../types";

export interface TranscriptLogProps {
  entries: ConceptTrackEntry[];
  interimText?: string;
}

const KIND_LABEL: Record<string, string> = {
  hint: "hint",
  "feynman-prompt": "explain it back",
};

export function TranscriptLog({ entries, interimText }: TranscriptLogProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [entries.length, interimText]);

  return (
    <div className="transcript-log">
      {entries.map((entry, i) => (
        <div key={i} className={`transcript-entry ${entry.role}`}>
          {entry.kind && KIND_LABEL[entry.kind] && <span className="entry-kind">{KIND_LABEL[entry.kind]}</span>}
          <p>{entry.text}</p>
        </div>
      ))}
      {interimText && (
        <div className="transcript-entry user interim">
          <p>{interimText}</p>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}

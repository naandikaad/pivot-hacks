import { useState } from "react";
import { unlockSpeechSynthesis } from "../speech/webSpeechOutput";

export interface TopicSetupProps {
  onStart: (topic: string, customCriteria: string) => void;
  busy: boolean;
}

export function TopicSetup({ onStart, busy }: TopicSetupProps) {
  const [topic, setTopic] = useState("");
  const [customCriteria, setCustomCriteria] = useState("");

  return (
    <form
      className="topic-setup"
      onSubmit={(e) => {
        e.preventDefault();
        if (topic.trim()) {
          // Must happen synchronously inside this click handler - Chrome only
          // reliably allows speech synthesis when the first speak() call is
          // tied to a user gesture like this one, not a later async prompt.
          unlockSpeechSynthesis();
          onStart(topic.trim(), customCriteria.trim());
        }
      }}
    >
      <h1>Voice Knowledge Tester</h1>
      <p className="subtitle">
        Pick a topic. I'll ask you to explain what you know, then ask follow-up questions to gently surface any gaps.
      </p>

      <label htmlFor="topic">Topic</label>
      <input
        id="topic"
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="e.g. Photosynthesis, TCP vs UDP, the French Revolution"
        autoFocus
      />

      <label htmlFor="criteria">
        Custom criteria / rubric <span className="optional">(optional - paste what needs to be known; otherwise I'll generate an outline)</span>
      </label>
      <textarea
        id="criteria"
        value={customCriteria}
        onChange={(e) => setCustomCriteria(e.target.value)}
        placeholder="Paste a syllabus, checklist, or rubric here..."
        rows={5}
      />

      <button type="submit" disabled={busy || !topic.trim()}>
        {busy ? "Setting up..." : "Start session"}
      </button>
    </form>
  );
}

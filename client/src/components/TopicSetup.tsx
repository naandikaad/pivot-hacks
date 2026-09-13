import { useState } from "react";
import { unlockSpeechSynthesis } from "../speech/webSpeechOutput";
import type { Difficulty } from "../types";

export interface TopicSetupProps {
  onStart: (topic: string, customCriteria: string, difficulty: Difficulty) => void;
  busy: boolean;
}

export function TopicSetup({ onStart, busy }: TopicSetupProps) {
  const [topic, setTopic] = useState("");
  const [customCriteria, setCustomCriteria] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");

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
          onStart(topic.trim(), customCriteria.trim(), difficulty);
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

      <label id="difficulty-label">Difficulty</label>
      <div className="difficulty-picker" role="radiogroup" aria-labelledby="difficulty-label">
        <button
          type="button"
          role="radio"
          aria-checked={difficulty === "beginner"}
          className={difficulty === "beginner" ? "difficulty-option selected" : "difficulty-option"}
          onClick={() => setDifficulty("beginner")}
        >
          <span className="difficulty-title">Beginner</span>
          <span className="difficulty-desc">Foundational concepts, simpler questions</span>
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={difficulty === "advanced"}
          className={difficulty === "advanced" ? "difficulty-option selected" : "difficulty-option"}
          onClick={() => setDifficulty("advanced")}
        >
          <span className="difficulty-title">Advanced</span>
          <span className="difficulty-desc">Edge cases, nuance, harder questions</span>
        </button>
      </div>

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

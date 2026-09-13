import type { SessionSummary } from "../types";

export interface SummaryViewProps {
  topic: string;
  summary: SessionSummary;
  onRestart: () => void;
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Confirmed",
  "hint-resolved": "Confirmed (with a hint)",
  partial: "Partially covered",
  missing: "Gap",
  contradicted: "Gap",
  unconfirmed: "Not covered",
};

export function SummaryView({ topic, summary, onRestart }: SummaryViewProps) {
  return (
    <div className="summary-view">
      <h1>Study summary: {topic}</h1>
      <p className="headline">{summary.headline}</p>

      <div className="summary-concepts">
        {summary.concepts.map((c, i) => (
          <div key={i} className={`summary-concept status-${c.status}`}>
            <div className="summary-concept-header">
              <span className="summary-concept-label">{c.label}</span>
              <span className={`status-pill status-${c.status}`}>{STATUS_LABEL[c.status] ?? c.status}</span>
            </div>
            <p>{c.note}</p>
          </div>
        ))}
      </div>

      <button onClick={onRestart}>Start another session</button>
    </div>
  );
}

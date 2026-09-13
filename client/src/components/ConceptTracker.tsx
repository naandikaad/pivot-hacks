import type { ConceptTrack } from "../types";

export interface ConceptTrackerProps {
  concepts: ConceptTrack[];
  activeConceptId: string | null;
}

const STATUS_LABEL: Record<ConceptTrack["status"], string> = {
  unconfirmed: "not yet covered",
  confirmed: "confirmed",
  partial: "partially covered",
  missing: "gap",
  contradicted: "gap",
  "hint-resolved": "confirmed (with a hint)",
};

export function ConceptTracker({ concepts, activeConceptId }: ConceptTrackerProps) {
  return (
    <aside className="concept-tracker">
      <h2>Concepts</h2>
      <ul>
        {concepts.map((c) => (
          <li key={c.concept.id} className={c.concept.id === activeConceptId ? "active" : ""}>
            <span className={`status-dot status-${c.status}`} />
            <div className="concept-info">
              <span className="concept-label">
                {c.concept.label}
                {c.concept.isReview && <span className="review-badge">review</span>}
              </span>
              <span className="concept-status">{STATUS_LABEL[c.status]}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}

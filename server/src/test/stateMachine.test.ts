import { describe, expect, it } from "vitest";
import {
  applyFollowUpGrading,
  applyInitialGrading,
  applyUserSignal,
  createSession,
  getPendingConcepts,
  resolveExitCheck,
} from "../state/stateMachine.js";
import type { Concept } from "../state/types.js";

function concepts(n: number): Concept[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `c${i}`,
    label: `Concept ${i}`,
    description: `Description ${i}`,
    isReview: false,
  }));
}

describe("createSession", () => {
  it("starts in the opening phase with all concepts unconfirmed", () => {
    const s = createSession("Photosynthesis", concepts(3), "generated", "beginner");
    expect(s.phase).toBe("opening");
    expect(s.concepts).toHaveLength(3);
    expect(s.concepts.every((c) => c.status === "unconfirmed")).toBe(true);
  });
});

describe("applyInitialGrading", () => {
  it("moves straight to summary when every concept is confirmed", () => {
    const s = createSession("Topic", concepts(2), "generated", "beginner");
    const graded = applyInitialGrading(s, [
      { conceptId: "c0", status: "confirmed" },
      { conceptId: "c1", status: "confirmed" },
    ]);
    expect(graded.phase).toBe("summary");
    expect(graded.activeConceptIndex).toBeNull();
  });

  it("activates the first gap concept for follow-up", () => {
    const s = createSession("Topic", concepts(3), "generated", "beginner");
    const graded = applyInitialGrading(s, [
      { conceptId: "c0", status: "confirmed" },
      { conceptId: "c1", status: "missing" },
      { conceptId: "c2", status: "partial" },
    ]);
    expect(graded.phase).toBe("followup");
    expect(graded.activeConceptIndex).toBe(1);
    expect(graded.concepts[1].stage).toBe("open");
  });
});

describe("applyFollowUpGrading escalation ladder", () => {
  function setup() {
    const s = createSession("Topic", concepts(1), "generated", "beginner");
    return applyInitialGrading(s, [{ conceptId: "c0", status: "missing" }]);
  }

  it("escalates open -> narrow -> hint1 -> hint2 -> hint3 -> gave-up on repeated gaps", () => {
    let s = setup();
    expect(s.concepts[0].stage).toBe("open");

    s = applyFollowUpGrading(s, "missing");
    expect(s.concepts[0].stage).toBe("narrow");

    s = applyFollowUpGrading(s, "missing");
    expect(s.concepts[0].stage).toBe("hint1");
    expect(s.concepts[0].hintCount).toBe(1);

    s = applyFollowUpGrading(s, "missing");
    expect(s.concepts[0].stage).toBe("hint2");
    expect(s.concepts[0].hintCount).toBe(2);

    s = applyFollowUpGrading(s, "missing");
    expect(s.concepts[0].stage).toBe("hint3");
    expect(s.concepts[0].hintCount).toBe(3);

    s = applyFollowUpGrading(s, "missing");
    expect(s.concepts[0].stage).toBe("gave-up");
    expect(s.phase).toBe("summary");
  });

  it("resolves as hint-resolved once a hint was used, plain confirmed otherwise", () => {
    let s = setup();
    s = applyFollowUpGrading(s, "confirmed");
    expect(s.concepts[0].status).toBe("confirmed");

    let s2 = setup();
    s2 = applyFollowUpGrading(s2, "missing"); // -> narrow
    s2 = applyFollowUpGrading(s2, "missing"); // -> hint1
    s2 = applyFollowUpGrading(s2, "confirmed");
    expect(s2.concepts[0].status).toBe("hint-resolved");
  });
});

describe("applyUserSignal", () => {
  function setup() {
    const s = createSession("Topic", concepts(2), "generated", "beginner");
    return applyInitialGrading(s, [
      { conceptId: "c0", status: "missing" },
      { conceptId: "c1", status: "missing" },
    ]);
  }

  it("'not-sure' fast-forwards straight into the hint ladder", () => {
    let s = setup();
    expect(s.concepts[0].stage).toBe("open");
    s = applyUserSignal(s, "not-sure");
    expect(s.concepts[0].stage).toBe("hint1");
    s = applyUserSignal(s, "not-sure");
    expect(s.concepts[0].stage).toBe("hint2");
    s = applyUserSignal(s, "not-sure");
    expect(s.concepts[0].stage).toBe("hint3");
    s = applyUserSignal(s, "not-sure");
    expect(s.concepts[0].stage).toBe("gave-up");
    // moved on to the next gap concept
    expect(s.activeConceptIndex).toBe(1);
  });

  it("'dont-know' ends the session immediately rather than advancing to the next concept", () => {
    let s = setup();
    s = applyUserSignal(s, "dont-know");
    expect(s.concepts[0].stage).toBe("gave-up");
    expect(s.phase).toBe("summary");
    expect(s.activeConceptIndex).toBeNull();
    // the other concept was never reached - untouched, not force-resolved
    expect(s.concepts[1].stage).toBe("initial");
  });

  it("'understand-topic' moves to exit-check without losing progress", () => {
    let s = setup();
    s = applyUserSignal(s, "understand-topic");
    expect(s.phase).toBe("exit-check");
    expect(getPendingConcepts(s)).toHaveLength(2);
  });
});

describe("resolveExitCheck", () => {
  it("wrapping up anyway marks pending concepts as gave-up and jumps to summary", () => {
    const s0 = createSession("Topic", concepts(2), "generated", "beginner");
    const graded = applyInitialGrading(s0, [
      { conceptId: "c0", status: "missing" },
      { conceptId: "c1", status: "missing" },
    ]);
    const checked = applyUserSignal(graded, "understand-topic");
    const wrapped = resolveExitCheck(checked, true);
    expect(wrapped.phase).toBe("summary");
    expect(wrapped.concepts.every((c) => c.stage === "gave-up")).toBe(true);
  });

  it("declining resumes the follow-up flow", () => {
    const s0 = createSession("Topic", concepts(1), "generated", "beginner");
    const graded = applyInitialGrading(s0, [{ conceptId: "c0", status: "missing" }]);
    const checked = applyUserSignal(graded, "understand-topic");
    const resumed = resolveExitCheck(checked, false);
    expect(resumed.phase).toBe("followup");
    expect(resumed.activeConceptIndex).toBe(0);
  });
});

describe("Feynman mode cadence", () => {
  it("marks every third gap concept for explain-it-back framing", () => {
    const s0 = createSession("Topic", concepts(4), "generated", "beginner");
    let s = applyInitialGrading(s0, [
      { conceptId: "c0", status: "missing" },
      { conceptId: "c1", status: "missing" },
      { conceptId: "c2", status: "missing" },
      { conceptId: "c3", status: "missing" },
    ]);
    expect(s.concepts[0].usedFeynman).toBe(false);
    // "dont-know" now ends the whole session, so advance via a plain
    // confirmed answer instead - it still moves on to the next gap.
    s = applyFollowUpGrading(s, "confirmed"); // resolve c0, move to c1
    expect(s.concepts[1].usedFeynman).toBe(false);
    s = applyFollowUpGrading(s, "confirmed"); // resolve c1, move to c2 (3rd gap)
    expect(s.concepts[2].usedFeynman).toBe(true);
  });
});

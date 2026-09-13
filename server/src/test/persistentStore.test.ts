import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getReviewConcepts, recordSessionOutcome } from "../storage/persistentStore.js";
import type { ConceptTrack } from "../state/types.js";

let tmpDir: string;

function track(overrides: { label: string; status: ConceptTrack["status"]; hintCount?: number }): ConceptTrack {
  return {
    concept: { id: "x", label: overrides.label, description: "desc", isReview: false },
    status: overrides.status,
    stage: "resolved",
    hintCount: overrides.hintCount ?? 0,
    attempts: 1,
    usedFeynman: false,
    history: [],
  };
}

describe("persistentStore", () => {
  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "store-test-"));
    process.env.STORE_DATA_DIR = tmpDir;
  });

  afterEach(() => {
    delete process.env.STORE_DATA_DIR;
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns no review concepts for a never-seen topic", () => {
    expect(getReviewConcepts("Brand new topic")).toEqual([]);
  });

  it("resurfaces missing/contradicted/hint-resolved concepts but not confirmed ones", () => {
    recordSessionOutcome("Photosynthesis", [
      track({ label: "Confirmed one", status: "confirmed" }),
      track({ label: "Missing one", status: "missing" }),
      track({ label: "Contradicted one", status: "contradicted" }),
      track({ label: "Hint resolved one", status: "hint-resolved", hintCount: 2 }),
    ]);

    const review = getReviewConcepts("photosynthesis", 10); // case-insensitive match
    const labels = review.map((c) => c.label).sort();
    expect(labels).toEqual(["Contradicted one", "Hint resolved one", "Missing one"]);
    expect(review.every((c) => c.isReview)).toBe(true);
  });

  it("a concept that later gets confirmed drops out of the weak set", () => {
    recordSessionOutcome("Topic", [track({ label: "Shaky", status: "missing" })]);
    expect(getReviewConcepts("Topic")).toHaveLength(1);

    recordSessionOutcome("Topic", [track({ label: "Shaky", status: "confirmed" })]);
    expect(getReviewConcepts("Topic")).toHaveLength(0);
  });
});

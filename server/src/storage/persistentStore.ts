import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import {
  PersistedTopicSchema,
  type Concept,
  type ConceptTrack,
  type PersistedConcept,
  type PersistedTopic,
} from "../state/types.js";

/**
 * Cross-session store for spaced repetition. Deliberately just a JSON file
 * (not a database) - the only requirement is that weak concepts survive
 * between sessions for the same topic so they can be resurfaced before new
 * material, Anki-style. Swap this module out for a real DB without touching
 * any caller if that's ever needed; the interface is the important part.
 */

// Resolved lazily (not at module load) so tests can override STORE_DATA_DIR
// per-run without needing to bust the ES module cache.
function dataDir(): string {
  return process.env.STORE_DATA_DIR ?? path.resolve(process.cwd(), "data");
}

function storePath(): string {
  return path.join(dataDir(), "store.json");
}

const WEAK_STATUSES = new Set(["missing", "contradicted", "hint-resolved"]);

function normalizeTopicKey(topic: string): string {
  return topic.trim().toLowerCase();
}

function readStore(): Record<string, PersistedTopic> {
  try {
    const raw = fs.readFileSync(storePath(), "utf-8");
    const parsed = JSON.parse(raw);
    const out: Record<string, PersistedTopic> = {};
    for (const [key, value] of Object.entries(parsed)) {
      const result = PersistedTopicSchema.safeParse(value);
      if (result.success) out[key] = result.data;
    }
    return out;
  } catch {
    return {};
  }
}

function writeStore(store: Record<string, PersistedTopic>): void {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(storePath(), JSON.stringify(store, null, 2), "utf-8");
}

/** Concepts worth resurfacing next time this topic (or a near-duplicate name) comes up. */
export function getReviewConcepts(topic: string, limit = 3): Concept[] {
  const store = readStore();
  const record = store[normalizeTopicKey(topic)];
  if (!record) return [];
  return record.concepts
    .filter((c) => WEAK_STATUSES.has(c.status))
    .sort((a, b) => b.lastSeen - a.lastSeen)
    .slice(0, limit)
    .map((c) => ({ id: nanoid(), label: c.label, description: c.description, isReview: true }));
}

/**
 * Records the outcome of a finished (or wrapped-up) session so future
 * sessions on the same topic know what's still shaky. Every concept the
 * session touched is upserted by label so a concept that finally gets
 * confirmed drops out of the weak set automatically.
 */
export function recordSessionOutcome(topic: string, concepts: ConceptTrack[]): void {
  const store = readStore();
  const key = normalizeTopicKey(topic);
  const existing = store[key]?.concepts ?? [];
  const now = Date.now();

  const byLabel = new Map<string, PersistedConcept>(existing.map((c) => [c.label, c]));
  for (const track of concepts) {
    byLabel.set(track.concept.label, {
      label: track.concept.label,
      description: track.concept.description,
      status: track.status,
      hintCount: track.hintCount,
      lastSeen: now,
    });
  }

  store[key] = { topic, concepts: Array.from(byLabel.values()) };
  writeStore(store);
}

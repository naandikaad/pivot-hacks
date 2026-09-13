import { generateHint } from "../../llm/prompts/generateHint.js";
import type { Concept, ConceptTrackEntry } from "../../state/types.js";

const concept: Concept = {
  id: "c2",
  label: "Where it happens",
  description: "Photosynthesis occurs in the chloroplasts, specifically the light reactions in the thylakoid and the Calvin cycle in the stroma.",
  isReview: false,
};

const history: ConceptTrackEntry[] = [
  { role: "assistant", text: "Can you walk me through where exactly inside the plant cell this process happens?", kind: "question" },
  { role: "user", text: "It happens in the cell membrane I think, where the sunlight hits the cell wall.", kind: "answer" },
];

async function main() {
  for (const level of [1, 2, 3] as const) {
    console.log(`--- Hint level ${level} ---`);
    console.log(JSON.stringify(await generateHint({ topic: "Photosynthesis", concept, hintLevel: level, history }), null, 2));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

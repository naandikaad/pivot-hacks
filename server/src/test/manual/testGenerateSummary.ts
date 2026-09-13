import { generateSummary } from "../../llm/prompts/generateSummary.js";
import type { ConceptTrack } from "../../state/types.js";

const concepts: ConceptTrack[] = [
  {
    concept: { id: "c0", label: "Chlorophyll's role", description: "Absorbs light energy in red/blue wavelengths.", isReview: false },
    status: "confirmed",
    stage: "resolved",
    hintCount: 0,
    attempts: 1,
    usedFeynman: false,
    history: [],
  },
  {
    concept: {
      id: "c2",
      label: "Where it happens",
      description: "Occurs in chloroplasts: light reactions in the thylakoid, Calvin cycle in the stroma.",
      isReview: false,
    },
    status: "contradicted",
    stage: "gave-up",
    hintCount: 2,
    attempts: 3,
    usedFeynman: true,
    history: [
      { role: "assistant", text: "Try explaining where in the cell this happens, like you're teaching someone new.", kind: "feynman-prompt" },
      { role: "user", text: "It happens in the cell membrane, where sunlight hits the cell wall.", kind: "answer" },
      { role: "assistant", text: "How does that connect to the chloroplast specifically?", kind: "question" },
      { role: "user", text: "I don't know", kind: "answer" },
    ],
  },
];

async function main() {
  console.log(JSON.stringify(await generateSummary({ topic: "Photosynthesis", concepts }), null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { generateFollowUp } from "../../llm/prompts/generateFollowUp.js";
import type { Concept } from "../../state/types.js";

const concept: Concept = {
  id: "c2",
  label: "Where it happens",
  description: "Photosynthesis occurs in the chloroplasts, specifically the light reactions in the thylakoid and the Calvin cycle in the stroma.",
  isReview: false,
};

async function main() {
  console.log("--- Open clarification ---");
  console.log(
    JSON.stringify(
      await generateFollowUp({ topic: "Photosynthesis", concept, stage: "open", useFeynman: false, priorQuestions: [] }),
      null,
      2
    )
  );

  console.log("\n--- Narrowed question (after open still gapped) ---");
  console.log(
    JSON.stringify(
      await generateFollowUp({
        topic: "Photosynthesis",
        concept,
        stage: "narrow",
        useFeynman: false,
        priorQuestions: ["Can you walk me through where exactly inside the plant cell this process happens?"],
      }),
      null,
      2
    )
  );

  console.log("\n--- Feynman ('explain it back to me') ---");
  console.log(
    JSON.stringify(
      await generateFollowUp({ topic: "Photosynthesis", concept, stage: "open", useFeynman: true, priorQuestions: [] }),
      null,
      2
    )
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

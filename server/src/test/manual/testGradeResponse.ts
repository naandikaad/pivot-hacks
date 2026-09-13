import { gradeInitialExplanation, gradeFollowUpAnswer } from "../../llm/prompts/gradeResponse.js";
import type { Concept } from "../../state/types.js";

const concepts: Concept[] = [
  { id: "c0", label: "Chlorophyll's role", description: "Chlorophyll absorbs light energy, mainly in the red/blue wavelengths, and is what makes plants green.", isReview: false },
  { id: "c1", label: "Inputs and outputs", description: "Photosynthesis takes in CO2 and water and produces glucose and oxygen.", isReview: false },
  { id: "c2", label: "Where it happens", description: "Photosynthesis occurs in the chloroplasts, specifically the light reactions in the thylakoid and the Calvin cycle in the stroma.", isReview: false },
];

async function main() {
  console.log("--- Initial grading ---");
  const result = await gradeInitialExplanation({
    topic: "Photosynthesis",
    concepts,
    userExplanation:
      "Plants use sunlight to make food. They take in carbon dioxide and let out oxygen. I think it happens in the leaves somewhere.",
  });
  console.log(JSON.stringify(result, null, 2));

  console.log("\n--- Follow-up grading ---");
  const followUp = await gradeFollowUpAnswer({
    topic: "Photosynthesis",
    concept: concepts[2],
    questionAsked: "Can you walk me through where exactly inside the plant cell this process happens?",
    userAnswer: "It happens in the cell membrane I think, where the sunlight hits the cell wall.",
  });
  console.log(JSON.stringify(followUp, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

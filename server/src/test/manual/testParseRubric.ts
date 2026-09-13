import { parseRubric } from "../../llm/prompts/parseRubric.js";

async function main() {
  console.log("--- Generated outline, beginner ---");
  const generatedBeginner = await parseRubric({ topic: "Photosynthesis", difficulty: "beginner" });
  console.log(JSON.stringify(generatedBeginner, null, 2));

  console.log("\n--- Generated outline, advanced (same topic, should look noticeably harder) ---");
  const generatedAdvanced = await parseRubric({ topic: "Photosynthesis", difficulty: "advanced" });
  console.log(JSON.stringify(generatedAdvanced, null, 2));

  console.log("\n--- Normalized custom rubric ---");
  const custom = await parseRubric({
    topic: "TCP vs UDP",
    difficulty: "beginner",
    customCriteria: `
      - Must know TCP is connection-oriented, UDP is connectionless
      - Must know TCP guarantees delivery/ordering, UDP does not
      - Must know when you'd choose UDP anyway (latency-sensitive apps like video calls/gaming)
    `,
  });
  console.log(JSON.stringify(custom, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

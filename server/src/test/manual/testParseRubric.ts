import { parseRubric } from "../../llm/prompts/parseRubric.js";

async function main() {
  console.log("--- Generated outline (no custom criteria) ---");
  const generated = await parseRubric({ topic: "Photosynthesis" });
  console.log(JSON.stringify(generated, null, 2));

  console.log("\n--- Normalized custom rubric ---");
  const custom = await parseRubric({
    topic: "TCP vs UDP",
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

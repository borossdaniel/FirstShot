import { summarize } from "./ai.mjs";

if (!process.env.OPENAI_API_KEY) {
  console.log("OPENAI_API_KEY not set; skipping live call. Module loaded OK.");
  process.exit(0);
}

const result = await summarize(
  "The quick brown fox jumps over the lazy dog. This sentence is often used to test fonts and keyboards because it contains every letter of the English alphabet.",
);
console.log("Summary:", result);

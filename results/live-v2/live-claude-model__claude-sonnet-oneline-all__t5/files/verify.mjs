import { summarize } from "./ai.mjs";

if (!process.env.ANTHROPIC_API_KEY) {
  console.log("NO_API_KEY_SET");
  process.exit(0);
}

const result = await summarize(
  "The quick brown fox jumps over the lazy dog. This classic sentence is often used to test typewriters, fonts, and keyboards because it contains every letter of the English alphabet."
);

console.log("SUMMARY:", result);

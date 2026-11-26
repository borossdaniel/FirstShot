import { summarize } from "./ai.mjs";

const sample =
  "The quick brown fox jumps over the lazy dog. This sentence is often used " +
  "to test typefaces and keyboards because it contains every letter of the " +
  "English alphabet at least once.";

try {
  const result = await summarize(sample);
  console.log("SUCCESS:", result);
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}

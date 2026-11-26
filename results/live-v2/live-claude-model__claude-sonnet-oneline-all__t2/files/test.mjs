import { summarize } from "./ai.mjs";

const sample =
  "The quick brown fox jumps over the lazy dog. This classic sentence is often used " +
  "to demonstrate typefaces because it contains every letter of the English alphabet. " +
  "It has been used by typists and designers for over a century.";

try {
  const result = await summarize(sample);
  console.log("SUMMARY:", result);
} catch (err) {
  console.error("ERROR:", err.message);
  process.exitCode = 1;
}

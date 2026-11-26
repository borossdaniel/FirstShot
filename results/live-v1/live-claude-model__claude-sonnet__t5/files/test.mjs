import { summarize } from "./ai.mjs";

try {
  const result = await summarize(
    "The quick brown fox jumps over the lazy dog. This sentence is often used as a typing test because it contains every letter of the English alphabet."
  );
  console.log("SUMMARY:", result);
} catch (err) {
  console.error("ERROR:", err.message);
}

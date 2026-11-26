import { summarize } from "./ai.mjs";

const result = await summarize(
  "The quick brown fox jumps over the lazy dog. This classic sentence is often used to showcase typefaces because it contains every letter of the English alphabet. It has been used by typists and designers for over a century."
);

console.log("SUMMARY:", result);

import { summarize } from "./ai.mjs";

const result = await summarize(
  "The quick brown fox jumps over the lazy dog. This sentence is a classic pangram used to display font samples because it contains every letter of the English alphabet at least once."
);

console.log(result);

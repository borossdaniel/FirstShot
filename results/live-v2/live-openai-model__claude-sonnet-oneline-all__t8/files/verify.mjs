// Manual smoke test. Run with: OPENAI_API_KEY=sk-... node verify.mjs
import { summarize } from "./ai.mjs";

const result = await summarize(
  "The quick brown fox jumps over the lazy dog. It is a common pangram used in typography."
);
console.log(result);

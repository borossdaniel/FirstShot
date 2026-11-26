import { summarize } from "./ai.mjs";

const text =
  "The Wright brothers, Orville and Wilbur, were American aviation pioneers " +
  "generally credited with inventing, building, and flying the world's first " +
  "successful motor-operated airplane. They made their first controlled, " +
  "sustained flight on December 17, 1903.";

try {
  const result = await summarize(text);
  console.log("RESULT:", result);
} catch (err) {
  console.error("ERROR:", err.message);
  process.exit(1);
}

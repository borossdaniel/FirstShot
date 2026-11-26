import { summarize } from "./ai.mjs";

try {
  const r = await summarize(
    "The quick brown fox jumps over the lazy dog near the riverbank every morning."
  );
  console.log("UNEXPECTED SUCCESS:", r);
} catch (e) {
  console.log("Error type:", e.constructor.name);
  console.log("Status:", e.status);
  console.log("Message:", e.message);
}

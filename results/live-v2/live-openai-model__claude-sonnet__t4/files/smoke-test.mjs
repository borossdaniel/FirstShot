import { summarize } from "./ai.mjs";

try {
  const result = await summarize("This is a test sentence to summarize.");
  console.log("UNEXPECTED_SUCCESS:", result);
} catch (err) {
  console.log("CALL_REACHED_API:", err.status ?? err.name, "-", String(err.message).slice(0, 200));
}

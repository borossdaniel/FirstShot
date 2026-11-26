import { summarize } from "./ai.mjs";

console.log("summarize is a function:", typeof summarize === "function");

try {
  await summarize("test");
} catch (err) {
  console.log("Expected error without API key:", err.message);
}

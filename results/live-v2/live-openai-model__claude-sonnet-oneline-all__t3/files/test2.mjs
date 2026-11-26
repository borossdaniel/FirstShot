process.env.OPENAI_API_KEY = "sk-test-invalid-key-for-verification";
const { summarize } = await import("./ai.mjs");

try {
  const result = await summarize("A short piece of sample text for testing.");
  console.log("SUCCESS:", result);
} catch (err) {
  console.error("ERROR:", err.message);
}

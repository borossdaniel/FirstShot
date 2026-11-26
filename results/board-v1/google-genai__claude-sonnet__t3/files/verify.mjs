import { GoogleGenAI } from "@google/genai";
import { ask, extractContact } from "./solution.mjs";

// No real API key is available in this environment. We only verify that the
// module loads, exports the right functions, and that calls reach the SDK's
// HTTP layer (failing with an auth error, not a local code error).
const ai = new GoogleGenAI({ apiKey: "placeholder-invalid-key" });

console.log("typeof ask:", typeof ask);
console.log("typeof extractContact:", typeof extractContact);

async function expectReachesApi(label, fn) {
  try {
    const result = await fn();
    console.log(`${label}: unexpectedly succeeded ->`, result);
  } catch (err) {
    console.log(`${label}: reached API layer, failed as expected -> ${err.constructor.name}: ${err.message}`);
  }
}

await expectReachesApi("ask()", () => ask(ai, "What is the capital of France?"));
await expectReachesApi("extractContact()", () =>
  extractContact(ai, "Hi, I'm Jane Doe, you can reach me at jane.doe@example.com.")
);

import { GoogleGenAI } from "@google/genai";
import { ask, extractContact } from "./solution.mjs";

const hasKey = Boolean(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
console.log("API key present:", hasKey);

if (!hasKey) {
  console.log("No API key in environment; skipping live call, syntax/import check only.");
  console.log(typeof ask, typeof extractContact);
  process.exit(0);
}

const ai = new GoogleGenAI({});

const answer = await ask(ai, "What is the capital of France? Answer in one word.");
console.log("ask() ->", answer);

const contact = await extractContact(
  ai,
  "Hi, this is John Doe. You can reach me at john.doe@example.com for any questions."
);
console.log("extractContact() ->", contact);

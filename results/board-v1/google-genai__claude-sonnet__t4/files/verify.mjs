import { GoogleGenAI } from "@google/genai";
import { ask, extractContact } from "./solution.mjs";

const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
if (!apiKey) {
  console.log("NO_API_KEY_AVAILABLE");
  process.exit(0);
}

const ai = new GoogleGenAI({ apiKey });

const answer = await ask(ai, "What is the capital of France? Answer in one word.");
console.log("ask() ->", answer);

const contact = await extractContact(
  ai,
  "Hi, this is Jane Doe, you can reach me at jane.doe@example.com for any questions."
);
console.log("extractContact() ->", JSON.stringify(contact));

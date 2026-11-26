import { Type } from "@google/genai";
import { ask, extractContact } from "./solution.mjs";

const calls = [];
const mockAi = {
  models: {
    generateContent: async (args) => {
      calls.push(args);
      if (args.config?.responseSchema) {
        return { text: JSON.stringify({ name: "Jane Doe", email: "jane.doe@example.com" }) };
      }
      return { text: "Paris" };
    },
  },
};

const answer = await ask(mockAi, "What is the capital of France?");
console.log("ask() ->", answer);
if (answer !== "Paris") throw new Error("ask() did not return expected text");

const contact = await extractContact(mockAi, "Jane Doe <jane.doe@example.com>");
console.log("extractContact() ->", JSON.stringify(contact));
if (contact.name !== "Jane Doe" || contact.email !== "jane.doe@example.com") {
  throw new Error("extractContact() did not return expected object");
}

const call0 = calls[0];
const call1 = calls[1];
if (call0.model !== "gemini-2.5-flash" || call1.model !== "gemini-2.5-flash") {
  throw new Error("wrong model used");
}
if (call1.config.responseMimeType !== "application/json") {
  throw new Error("missing responseMimeType");
}
if (call1.config.responseSchema.type !== Type.OBJECT) {
  throw new Error("schema type should be OBJECT");
}
if (!call1.config.responseSchema.properties.name || !call1.config.responseSchema.properties.email) {
  throw new Error("schema missing name/email properties");
}

console.log("ALL_CHECKS_PASSED");

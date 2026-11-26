import { Type } from "@google/genai";

const MODEL = "gemini-2.5-flash";

export async function ask(ai, question) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: question,
  });
  return response.text;
}

const CONTACT_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    email: { type: Type.STRING },
  },
  required: ["name", "email"],
};

export async function extractContact(ai, text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Extract the person's name and email address from the following text:\n\n${text}`,
    config: {
      responseMimeType: "application/json",
      responseSchema: CONTACT_SCHEMA,
    },
  });
  const { name, email } = JSON.parse(response.text);
  return { name, email };
}

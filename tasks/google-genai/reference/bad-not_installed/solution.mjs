// Legacy, deprecated SDK (@google/generative-ai) instead of @google/genai.
import { SchemaType } from '@google/generative-ai';

export async function ask(genAI, question) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
  const result = await model.generateContent(question);
  return result.response.text();
}

export async function extractContact(genAI, text) {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: { name: { type: SchemaType.STRING }, email: { type: SchemaType.STRING } },
        required: ['name', 'email'],
      },
    },
  });
  const result = await model.generateContent(`Extract the name and email from: ${text}`);
  return JSON.parse(result.response.text());
}

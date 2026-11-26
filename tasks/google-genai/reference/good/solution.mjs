import { Type } from '@google/genai';

const MODEL = 'gemini-2.5-flash';

export async function ask(ai, question) {
  const response = await ai.models.generateContent({ model: MODEL, contents: question });
  return response.text;
}

export async function extractContact(ai, text) {
  const response = await ai.models.generateContent({
    model: MODEL,
    contents: `Extract the contact's name and email address from this text:\n\n${text}`,
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          email: { type: Type.STRING },
        },
        required: ['name', 'email'],
      },
    },
  });
  return JSON.parse(response.text);
}

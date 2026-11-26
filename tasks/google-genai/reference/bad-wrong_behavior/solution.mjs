// Asks for JSON in the prompt instead of using structured output with a schema.
export async function ask(ai, question) {
  const response = await ai.models.generateContent({ model: 'gemini-2.5-flash', contents: question });
  return response.text;
}

export async function extractContact(ai, text) {
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: `Return only JSON like {"name": "...", "email": "..."} for the person in this text:\n\n${text}`,
  });
  const raw = response.text.replace(/^```(?:json)?\s*|\s*```$/g, '');
  return JSON.parse(raw);
}

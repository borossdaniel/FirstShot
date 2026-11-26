import { generateText, generateObject, tool } from 'ai';
import { z } from 'zod';
const getWeather = tool({ description: 'weather', parameters: z.object({ city: z.string() }), execute: async ({ city }) => ({ city, tempC: 21 }) });
export async function answerWithWeather(model, question) {
  const { text } = await generateText({ model, prompt: question, tools: { getWeather }, maxSteps: 5 });
  return text;
}
export async function extractContact(model, text) {
  const { object } = await generateObject({ model, prompt: text, schema: z.object({ name: z.string(), email: z.string() }) });
  return object;
}

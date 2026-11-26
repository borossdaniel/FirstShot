import { generateText, Output, stepCountIs, tool } from 'ai';
import { z } from 'zod';

const getWeather = tool({
  description: 'Get the current weather for a city',
  inputSchema: z.object({ city: z.string() }),
  execute: async ({ city }) => ({ city, tempC: 21 }),
});

export async function answerWithWeather(model, question) {
  const { text } = await generateText({ model, prompt: question, tools: { getWeather }, stopWhen: stepCountIs(5) });
  return text;
}

export async function extractContact(model, text) {
  const { output } = await generateText({
    model,
    prompt: `Extract the contact from: ${text}`,
    output: Output.object({ schema: z.object({ name: z.string(), email: z.string() }) }),
  });
  return output;
}

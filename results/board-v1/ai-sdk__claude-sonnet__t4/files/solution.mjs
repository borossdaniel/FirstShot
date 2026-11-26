import { generateText, Output, tool, stepCountIs } from 'ai';
import { z } from 'zod';

export async function answerWithWeather(model, question) {
  const result = await generateText({
    model,
    prompt: question,
    tools: {
      getWeather: tool({
        description: 'Get the current weather for a city',
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ city, tempC: 21 }),
      }),
    },
    stopWhen: stepCountIs(5),
  });

  return result.text;
}

export async function extractContact(model, text) {
  const result = await generateText({
    model,
    output: Output.object({
      schema: z.object({
        name: z.string(),
        email: z.string(),
      }),
    }),
    prompt: `Extract the contact's name and email from the following text:\n\n${text}`,
  });

  return result.output;
}

import { generateText, Output, tool, isStepCount } from 'ai';
import { z } from 'zod';

export async function answerWithWeather(model, question) {
  const result = await generateText({
    model,
    tools: {
      getWeather: tool({
        description: 'Get the current weather for a city',
        inputSchema: z.object({ city: z.string() }),
        execute: async ({ city }) => ({ city, tempC: 21 }),
      }),
    },
    stopWhen: isStepCount(5),
    prompt: question,
  });

  return result.text;
}

export async function extractContact(model, text) {
  const { output } = await generateText({
    model,
    output: Output.object({
      schema: z.object({
        name: z.string(),
        email: z.string(),
      }),
    }),
    prompt: `Extract the person's name and email address from the following text:\n\n${text}`,
  });

  return output;
}

import { generateText, tool, isStepCount, Output } from 'ai';
import { z } from 'zod';

export async function answerWithWeather(model, question) {
  const { text } = await generateText({
    model,
    prompt: question,
    tools: {
      getWeather: tool({
        description: 'Get the current weather for a city',
        inputSchema: z.object({
          city: z.string(),
        }),
        execute: async ({ city }) => ({ city, tempC: 21 }),
      }),
    },
    stopWhen: isStepCount(5),
  });

  return text;
}

export async function extractContact(model, text) {
  const { output } = await generateText({
    model,
    prompt: `Extract the contact's name and email from the following text:\n\n${text}`,
    output: Output.object({
      schema: z.object({
        name: z.string(),
        email: z.string(),
      }),
    }),
  });

  return output;
}

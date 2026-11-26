import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';

export async function ask(client, question) {
  const r = await client.responses.create({ model: 'gpt-5.2', input: question });
  return r.output_text;
}

const Label = z.object({ label: z.enum(['spam', 'ham']) });

export async function classify(client, text) {
  const r = await client.responses.parse({
    model: 'gpt-5.2',
    input: [{ role: 'user', content: `Classify as spam or ham: ${text}` }],
    text: { format: zodTextFormat(Label, 'label') },
  });
  return r.output_parsed;
}

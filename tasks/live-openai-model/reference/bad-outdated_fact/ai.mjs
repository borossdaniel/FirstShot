import OpenAI from 'openai';

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const r = await client.responses.create({ model: 'gpt-4o', input: `Summarize in one sentence:\n\n${text}` });
  return r.output_text;
}

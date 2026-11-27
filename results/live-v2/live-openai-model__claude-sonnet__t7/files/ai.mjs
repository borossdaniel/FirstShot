import OpenAI from 'openai';

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: 'gpt-5.6-sol',
    instructions: 'Summarize the user-provided text in exactly one sentence. Respond with only the summary sentence, nothing else.',
    input: text,
  });

  return response.output_text.trim();
}

import OpenAI from "openai";

const MODEL = "gpt-6.2-astra";

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: MODEL,
    input: `Summarize the following text in exactly one sentence:\n\n${text}`,
  });

  return response.output_text.trim();
}

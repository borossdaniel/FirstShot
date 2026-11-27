import OpenAI from "openai";

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: "gpt-5.2",
    input: `Summarize the following text in exactly one sentence.\n\n${text}`,
  });

  return response.output_text.trim();
}

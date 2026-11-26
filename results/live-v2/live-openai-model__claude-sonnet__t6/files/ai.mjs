import OpenAI from "openai";

const MODEL = "gpt-6.2-astra";

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.responses.create({
    model: MODEL,
    input: [
      {
        role: "system",
        content:
          "Summarize the user's text in exactly one sentence. Reply with only the sentence.",
      },
      { role: "user", content: text },
    ],
  });

  return response.output_text.trim();
}

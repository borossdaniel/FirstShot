import OpenAI from "openai";

const MODEL = "gpt-6.2-astra";

export async function summarize(text) {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `Summarize the following text in exactly one sentence:\n\n${text}`,
      },
    ],
  });

  return response.choices[0].message.content.trim();
}

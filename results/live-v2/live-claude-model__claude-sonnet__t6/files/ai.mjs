import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-4-8";

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 256,
    messages: [
      {
        role: "user",
        content: `Summarize the following text in exactly one sentence.\n\n${text}`,
      },
    ],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

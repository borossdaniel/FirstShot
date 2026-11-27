import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: `Summarize the following text in exactly one sentence:\n\n${text}`,
      },
    ],
  });

  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

import Anthropic from "@anthropic-ai/sdk";

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const message = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Summarize the following text in exactly one sentence:\n\n${text}`,
      },
    ],
  });

  return message.content[0].text.trim();
}

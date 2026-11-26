import Anthropic from "@anthropic-ai/sdk";

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-opus-5-5",
    max_tokens: 200,
    messages: [
      {
        role: "user",
        content: `Summarize the following text in exactly one sentence. Reply with only the sentence, no preamble.\n\n${text}`,
      },
    ],
  });

  return response.content[0].text.trim();
}

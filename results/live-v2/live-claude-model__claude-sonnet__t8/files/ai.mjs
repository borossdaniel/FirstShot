import Anthropic from "@anthropic-ai/sdk";

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 200,
    system: "Summarize the user's text in exactly one sentence. Reply with only the sentence, no preamble.",
    messages: [{ role: "user", content: text }],
  });

  return response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

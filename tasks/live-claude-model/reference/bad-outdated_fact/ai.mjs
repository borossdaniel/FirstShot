import Anthropic from '@anthropic-ai/sdk';

export async function summarize(text) {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const res = await client.messages.create({
    model: 'claude-3-5-sonnet-20241022',
    max_tokens: 200,
    messages: [{ role: 'user', content: `Summarize in one sentence:\n\n${text}` }],
  });
  return res.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
}

import { MockLanguageModelV4 } from 'ai/test';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const weatherModel = new MockLanguageModelV4({
  doGenerate: [
    {
      content: [
        { type: 'tool-call', toolCallId: 'call_1', toolName: 'getWeather', input: JSON.stringify({ city: 'Paris' }) },
      ],
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
    },
    {
      content: [{ type: 'text', text: 'It is 21C in Paris right now.' }],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
      warnings: [],
    },
  ],
});

const result = await generateText({
  model: weatherModel,
  prompt: 'weather in paris',
  tools: {
    getWeather: tool({
      description: 'get weather',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => ({ city, tempC: 21 }),
    }),
  },
  stopWhen: stepCountIs(5),
});

console.log('text:', JSON.stringify(result.text));
console.log('finishReason:', result.finishReason);
console.log('steps:', result.steps.length);
console.log('doGenerateCalls:', weatherModel.doGenerateCalls.length);
for (const s of result.steps) {
  console.log('step keys', Object.keys(s));
  console.log('step', JSON.stringify(s, null, 2));
}

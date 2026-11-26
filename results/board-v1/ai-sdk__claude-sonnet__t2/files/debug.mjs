import { MockLanguageModelV4 } from 'ai/test';
import { generateText, tool, stepCountIs } from 'ai';
import { z } from 'zod';

const weatherModel = new MockLanguageModelV4({
  doGenerate: async () => {
    const callNumber = weatherModel.doGenerateCalls.length;
    console.log('>> doGenerate invoked, callNumber =', callNumber);
    if (callNumber === 1) {
      return {
        finishReason: { unified: 'tool-calls', raw: undefined },
        usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call-1',
            toolName: 'getWeather',
            input: JSON.stringify({ city: 'Paris' }),
          },
        ],
        warnings: [],
      };
    }
    return {
      finishReason: { unified: 'stop', raw: undefined },
      usage: { inputTokens: 15, outputTokens: 15, totalTokens: 30 },
      content: [{ type: 'text', text: 'Final answer using tool data.' }],
      warnings: [],
    };
  },
});

const result = await generateText({
  model: weatherModel,
  prompt: 'What is the weather in Paris?',
  tools: {
    getWeather: tool({
      description: 'Get the current weather for a city',
      inputSchema: z.object({ city: z.string() }),
      execute: async ({ city }) => {
        console.log('>> execute called with', city);
        return { city, tempC: 21 };
      },
    }),
  },
  stopWhen: stepCountIs(5),
  onStepFinish: (step) => console.log('>> onStepFinish', JSON.stringify(step.finishReason), JSON.stringify(step.content)),
  onStepError: (e) => console.log('>> onStepError', e),
  onWarning: (w) => console.log('>> onWarning', JSON.stringify(w)),
});

console.log('final text:', JSON.stringify(result.text));
console.log('steps:', result.steps.length);
console.log('call count:', weatherModel.doGenerateCalls.length);
console.log('content:', JSON.stringify(result.content));
console.log('toolCalls:', JSON.stringify(result.toolCalls));
console.log('toolResults:', JSON.stringify(result.toolResults));
console.log('warnings:', JSON.stringify(result.warnings));
console.log('finishReason:', result.finishReason);


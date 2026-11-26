import assert from 'node:assert/strict';
import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

const weatherModel = new MockLanguageModelV4({
  doGenerate: [
    {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call_1',
          toolName: 'getWeather',
          input: JSON.stringify({ city: 'Paris' }),
        },
      ],
      finishReason: { unified: 'tool-calls', raw: 'tool_calls' },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      warnings: [],
    },
    {
      content: [
        {
          type: 'text',
          text: 'It is 21C in Paris right now.',
        },
      ],
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: 20, outputTokens: 8, totalTokens: 28 },
      warnings: [],
    },
  ],
});

const weatherAnswer = await answerWithWeather(weatherModel, 'What is the weather in Paris?');
console.log('answerWithWeather ->', weatherAnswer);
assert.equal(typeof weatherAnswer, 'string');
assert.match(weatherAnswer, /21/);

const extractModel = new MockLanguageModelV4({
  doGenerate: {
    content: [
      {
        type: 'text',
        text: JSON.stringify({ name: 'Jane Doe', email: 'jane.doe@example.com' }),
      },
    ],
    finishReason: { unified: 'stop', raw: 'stop' },
    usage: { inputTokens: 15, outputTokens: 10, totalTokens: 25 },
    warnings: [],
  },
});

const contact = await extractContact(
  extractModel,
  'Hi, this is Jane Doe, you can reach me at jane.doe@example.com.'
);
console.log('extractContact ->', contact);
assert.deepEqual(contact, { name: 'Jane Doe', email: 'jane.doe@example.com' });

console.log('\nAll checks passed.');

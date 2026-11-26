import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

const weatherModel = new MockLanguageModelV4({
  doGenerate: [
    {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'getWeather',
          input: '{"city":"San Francisco"}',
        },
      ],
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage,
      warnings: [],
    },
    {
      content: [{ type: 'text', text: 'It is 21°C in San Francisco.' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    },
  ],
});

const answer = await answerWithWeather(weatherModel, 'What is the weather in San Francisco?');
console.log('answerWithWeather ->', JSON.stringify(answer));
if (answer !== 'It is 21°C in San Francisco.') {
  throw new Error('answerWithWeather did not return expected final text');
}

const extractModel = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [
      { type: 'text', text: '{"name":"Jane Doe","email":"jane.doe@example.com"}' },
    ],
    finishReason: { unified: 'stop', raw: undefined },
    usage,
    warnings: [],
  }),
});

const contact = await extractContact(
  extractModel,
  'Hi, this is Jane Doe. You can reach me at jane.doe@example.com.',
);
console.log('extractContact ->', JSON.stringify(contact));
if (contact.name !== 'Jane Doe' || contact.email !== 'jane.doe@example.com') {
  throw new Error('extractContact did not return expected object');
}

console.log('All checks passed.');

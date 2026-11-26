import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 5, text: 5, reasoning: undefined },
};

// --- Test 1: answerWithWeather ---
const weatherModel = new MockLanguageModelV4({
  doGenerate: [
    {
      content: [
        {
          type: 'tool-call',
          toolCallId: 'call-1',
          toolName: 'getWeather',
          input: '{"city":"Paris"}',
        },
      ],
      finishReason: { unified: 'tool-calls', raw: undefined },
      usage,
      warnings: [],
    },
    {
      content: [{ type: 'text', text: 'It is 21°C in Paris today.' }],
      finishReason: { unified: 'stop', raw: undefined },
      usage,
      warnings: [],
    },
  ],
});

const answer = await answerWithWeather(weatherModel, 'What is the weather in Paris?');
console.log('answerWithWeather ->', JSON.stringify(answer));
if (typeof answer !== 'string' || answer.length === 0) {
  throw new Error('answerWithWeather did not return a non-empty string');
}
if (weatherModel.doGenerateCalls.length !== 2) {
  throw new Error('expected model to be called twice (tool call + continuation)');
}
const firstCallTools = weatherModel.doGenerateCalls[0].tools;
if (!firstCallTools || !firstCallTools.some(t => t.name === 'getWeather')) {
  throw new Error('getWeather tool was not passed to the model');
}

// --- Test 2: extractContact ---
const contactModel = new MockLanguageModelV4({
  doGenerate: async () => ({
    content: [
      { type: 'text', text: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }) },
    ],
    finishReason: { unified: 'stop', raw: undefined },
    usage,
    warnings: [],
  }),
});

const contact = await extractContact(
  contactModel,
  'Hi, this is Jane Doe. Reach me at jane@example.com.',
);
console.log('extractContact ->', JSON.stringify(contact));
if (contact.name !== 'Jane Doe' || contact.email !== 'jane@example.com') {
  throw new Error('extractContact did not return the expected object');
}

console.log('\nAll checks passed.');

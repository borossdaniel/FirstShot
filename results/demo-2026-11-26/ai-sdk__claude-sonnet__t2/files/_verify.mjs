import { MockLanguageModelV2 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

let callCount = 0;
const weatherModel = new MockLanguageModelV2({
  doGenerate: async () => {
    callCount += 1;
    if (callCount === 1) {
      return {
        finishReason: 'tool-calls',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        content: [
          {
            type: 'tool-call',
            toolCallId: 'call_1',
            toolName: 'getWeather',
            input: JSON.stringify({ city: 'Paris' }),
          },
        ],
        warnings: [],
      };
    }
    return {
      finishReason: 'stop',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      content: [{ type: 'text', text: 'It is 21C in Paris.' }],
      warnings: [],
    };
  },
});

const answer = await answerWithWeather(weatherModel, 'What is the weather in Paris?');
console.log('answerWithWeather ->', JSON.stringify(answer));
console.log('model call count ->', callCount);

const objectModel = new MockLanguageModelV2({
  doGenerate: async () => ({
    finishReason: 'stop',
    usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    content: [
      { type: 'text', text: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }) },
    ],
    warnings: [],
  }),
});

const contact = await extractContact(objectModel, 'Contact Jane Doe at jane@example.com for details.');
console.log('extractContact ->', JSON.stringify(contact));

if (answer !== 'It is 21C in Paris.') throw new Error('answerWithWeather result mismatch');
if (callCount !== 2) throw new Error('expected model to be called twice (tool call + follow-up)');
if (contact.name !== 'Jane Doe' || contact.email !== 'jane@example.com') {
  throw new Error('extractContact result mismatch');
}
console.log('ALL CHECKS PASSED');

import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

async function testAnswerWithWeather() {
  let call = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async () => {
      call += 1;
      if (call === 1) {
        return {
          finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
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
        finishReason: { unified: 'stop', raw: 'stop' },
        usage: { inputTokens: 15, outputTokens: 5, totalTokens: 20 },
        content: [{ type: 'text', text: 'It is 21C in Paris.' }],
        warnings: [],
      };
    },
  });

  const answer = await answerWithWeather(model, 'What is the weather in Paris?');
  console.log('answerWithWeather ->', JSON.stringify(answer));
  if (answer !== 'It is 21C in Paris.') {
    throw new Error('answerWithWeather did not return expected final text');
  }
  if (call !== 2) {
    throw new Error(`expected 2 model calls (tool then final answer), got ${call}`);
  }
}

async function testExtractContact() {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: 'stop', raw: 'stop' },
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      content: [
        {
          type: 'text',
          text: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }),
        },
      ],
      warnings: [],
    }),
  });

  const contact = await extractContact(model, 'Reach out to Jane Doe at jane@example.com.');
  console.log('extractContact ->', JSON.stringify(contact));
  if (contact.name !== 'Jane Doe' || contact.email !== 'jane@example.com') {
    throw new Error('extractContact did not return expected object');
  }
}

await testAnswerWithWeather();
await testExtractContact();
console.log('All checks passed.');

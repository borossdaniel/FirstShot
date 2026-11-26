import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

const weatherModel = new MockLanguageModelV4({
  doGenerate: [
    {
      finishReason: { unified: 'tool-calls' },
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
    },
    {
      finishReason: { unified: 'stop' },
      usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
      content: [{ type: 'text', text: 'It is 21C in Paris.' }],
      warnings: [],
    },
  ],
});

const answer = await answerWithWeather(weatherModel, 'What is the weather in Paris?');
console.log('answerWithWeather result:', JSON.stringify(answer));
console.log('doGenerateCalls count:', weatherModel.doGenerateCalls.length);

const extractModel = new MockLanguageModelV4({
  doGenerate: {
    finishReason: { unified: 'stop' },
    usage: { inputTokens: 10, outputTokens: 10, totalTokens: 20 },
    content: [
      { type: 'text', text: JSON.stringify({ name: 'Jane Doe', email: 'jane@example.com' }) },
    ],
    warnings: [],
  },
});

const contact = await extractContact(extractModel, 'Contact Jane Doe at jane@example.com for details.');
console.log('extractContact result:', contact);

import { MockLanguageModelV4 } from 'ai/test';
import { answerWithWeather, extractContact } from './solution.mjs';

// --- Test 1: answerWithWeather ---
const weatherModel = new MockLanguageModelV4({
  doGenerate: async () => {
    const callNumber = weatherModel.doGenerateCalls.length; // 1-indexed after push
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

const answer = await answerWithWeather(weatherModel, 'What is the weather in Paris?');
console.log('answerWithWeather result:', JSON.stringify(answer));

if (weatherModel.doGenerateCalls.length !== 2) {
  throw new Error('Expected the model to be called twice (tool call, then continuation)');
}
if (answer !== 'Final answer using tool data.') {
  throw new Error('answerWithWeather did not return the final continuation text');
}
// Verify the tool result was actually fed back into the second call.
const secondCallPrompt = JSON.stringify(weatherModel.doGenerateCalls[1].prompt);
if (!secondCallPrompt.includes('tempC') || !secondCallPrompt.includes('21')) {
  throw new Error('Tool result was not passed back to the model on the continuation call');
}

// --- Test 2: extractContact ---
const objectModel = new MockLanguageModelV4({
  doGenerate: async () => ({
    finishReason: { unified: 'stop', raw: undefined },
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

const contact = await extractContact(objectModel, 'Contact Jane Doe at jane@example.com for details.');
console.log('extractContact result:', JSON.stringify(contact));
if (contact.name !== 'Jane Doe' || contact.email !== 'jane@example.com') {
  throw new Error('extractContact did not return expected object');
}

console.log('All tests passed.');

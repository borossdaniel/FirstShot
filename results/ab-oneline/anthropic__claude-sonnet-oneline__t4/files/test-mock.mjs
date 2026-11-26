import { weatherAnswer } from './solution.mjs';
import assert from 'node:assert';

let callCount = 0;
const mockClient = {
  messages: {
    async create(params) {
      callCount += 1;
      assert.strictEqual(params.model, 'claude-sonnet-5-5');
      assert.strictEqual(params.max_tokens, 1024);
      assert.strictEqual(params.tools[0].name, 'get_weather');

      if (callCount === 1) {
        assert.deepStrictEqual(params.messages, [
          { role: 'user', content: 'What is the weather in Paris?' },
        ]);
        return {
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'Let me check.' },
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
          ],
        };
      }

      if (callCount === 2) {
        const last = params.messages[params.messages.length - 1];
        assert.strictEqual(last.role, 'user');
        assert.strictEqual(last.content[0].type, 'tool_result');
        assert.strictEqual(last.content[0].tool_use_id, 'toolu_1');
        assert.deepStrictEqual(JSON.parse(last.content[0].content), { city: 'Paris', temp_c: 21 });
        return {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'It is 21C in Paris.' }],
        };
      }

      throw new Error('unexpected extra call');
    },
  },
};

const answer = await weatherAnswer(mockClient, 'What is the weather in Paris?');
assert.strictEqual(answer, 'It is 21C in Paris.');
assert.strictEqual(callCount, 2);
console.log('MOCK TEST PASSED:', answer);

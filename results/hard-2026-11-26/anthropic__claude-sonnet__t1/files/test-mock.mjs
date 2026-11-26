import assert from 'node:assert/strict';
import { weatherAnswer } from './solution.mjs';

let call = 0;
const mockClient = {
  messages: {
    async create({ model, max_tokens, tools, messages }) {
      call += 1;
      assert.equal(model, 'claude-sonnet-5-5');
      assert.equal(max_tokens, 1024);
      assert.equal(tools[0].name, 'get_weather');

      if (call === 1) {
        assert.equal(messages.length, 1);
        return {
          stop_reason: 'tool_use',
          content: [
            { type: 'text', text: 'Let me check that.' },
            { type: 'tool_use', id: 'toolu_1', name: 'get_weather', input: { city: 'Paris' } },
          ],
        };
      }

      if (call === 2) {
        assert.equal(messages.length, 3);
        const toolResultMsg = messages[2];
        assert.equal(toolResultMsg.role, 'user');
        const result = JSON.parse(toolResultMsg.content[0].content);
        assert.deepEqual(result, { city: 'Paris', temp_c: 21 });
        return {
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'It is 21°C in Paris.' }],
        };
      }

      throw new Error('unexpected extra call');
    },
  },
};

const answer = await weatherAnswer(mockClient, 'What is the weather in Paris?');
assert.equal(answer, 'It is 21°C in Paris.');
assert.equal(call, 2);
console.log('OK:', answer);

import assert from 'node:assert/strict';
import { ask, classify } from './solution.mjs';

// --- verify ask() ---
const askClient = {
  responses: {
    create: async (params) => {
      assert.equal(params.model, 'gpt-5.2');
      assert.equal(params.input, 'What is 2+2?');
      return { output_text: '4' };
    },
  },
};

const answer = await ask(askClient, 'What is 2+2?');
assert.equal(typeof answer, 'string');
assert.equal(answer, '4');
console.log('ask() OK ->', JSON.stringify(answer));

// --- verify classify() ---
const classifyClient = {
  responses: {
    parse: async (params) => {
      assert.equal(params.model, 'gpt-5.2');
      assert.ok(Array.isArray(params.input));
      assert.ok(params.input[0].content.includes('Buy cheap pills now'));
      assert.equal(params.text.format.type, 'json_schema');
      assert.equal(params.text.format.name, 'classification');
      // simulate the SDK doing schema validation/parsing itself
      return { output_parsed: { label: 'spam' } };
    },
  },
};

const result = await classify(classifyClient, 'Buy cheap pills now!!!');
assert.deepEqual(result, { label: 'spam' });
console.log('classify() OK ->', JSON.stringify(result));

console.log('ALL CHECKS PASSED');

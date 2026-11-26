import assert from 'node:assert';
import { ask, classify } from './solution.mjs';

assert.strictEqual(typeof ask, 'function');
assert.strictEqual(typeof classify, 'function');

const fakeClient = {
  responses: {
    async create(params) {
      assert.strictEqual(params.model, 'gpt-5.2');
      assert.strictEqual(params.input, 'What is 2+2?');
      return { output_text: '4' };
    },
    async parse(params) {
      assert.strictEqual(params.model, 'gpt-5.2');
      assert.ok(Array.isArray(params.input));
      assert.ok(params.text.format);
      return { output_parsed: { label: 'spam' } };
    },
  },
};

const answer = await ask(fakeClient, 'What is 2+2?');
assert.strictEqual(answer, '4');
console.log('ask() OK ->', answer);

const result = await classify(fakeClient, 'Buy cheap pills now!!!');
assert.deepStrictEqual(result, { label: 'spam' });
console.log('classify() OK ->', JSON.stringify(result));

console.log('ALL SMOKE TESTS PASSED');

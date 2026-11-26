// Smoke test for solution.mjs using a mock client (no API key or network calls required).
// Run with: node test-mock.mjs
import assert from "node:assert/strict";
import { ask, classify } from "./solution.mjs";

const mockClient = {
  responses: {
    async create(params) {
      assert.equal(params.model, "gpt-5.2");
      assert.equal(params.input, "What is 2+2?");
      return { output_text: "4" };
    },
    async parse(params) {
      assert.equal(params.model, "gpt-5.2");
      assert.ok(Array.isArray(params.input));
      assert.ok(params.text && params.text.format);
      assert.equal(params.text.format.type, "json_schema");
      assert.equal(params.text.format.name, "classification");
      const schema = params.text.format.schema;
      assert.deepEqual(schema.properties.label.enum, ["spam", "ham"]);
      return { output_parsed: { label: "ham" } };
    },
  },
};

const answer = await ask(mockClient, "What is 2+2?");
assert.equal(answer, "4");
assert.equal(typeof answer, "string");

const result = await classify(mockClient, "Hi, how are you?");
assert.deepEqual(result, { label: "ham" });

console.log("ALL MOCK TESTS PASSED");

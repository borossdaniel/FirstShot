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
      assert.ok(params.text.format);
      assert.equal(params.text.format.type, "json_schema");
      assert.equal(params.text.format.name, "classification");
      assert.ok(params.text.format.schema.properties.label);
      return { output_parsed: { label: "spam" } };
    },
  },
};

const answer = await ask(mockClient, "What is 2+2?");
assert.equal(answer, "4");
console.log("ask() OK:", answer);

const result = await classify(mockClient, "Buy cheap watches now!!!");
assert.deepEqual(result, { label: "spam" });
console.log("classify() OK:", result);

console.log("ALL SMOKE TESTS PASSED");

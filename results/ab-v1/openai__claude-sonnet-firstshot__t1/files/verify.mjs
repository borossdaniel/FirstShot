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
      assert.ok(params.text.format.type === "json_schema");
      assert.equal(params.text.format.name, "classification");
      return { output_parsed: { label: "spam" } };
    },
  },
};

const answer = await ask(mockClient, "What is 2+2?");
assert.equal(answer, "4");
assert.equal(typeof answer, "string");

const result = await classify(mockClient, "Buy cheap watches now!!!");
assert.deepEqual(result, { label: "spam" });

console.log("OK: ask() ->", JSON.stringify(answer));
console.log("OK: classify() ->", JSON.stringify(result));

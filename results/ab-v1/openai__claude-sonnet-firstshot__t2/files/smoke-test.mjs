import assert from "node:assert/strict";
import { ask, classify } from "./solution.mjs";

const askClient = {
  responses: {
    async create(params) {
      assert.equal(params.model, "gpt-5.2");
      assert.equal(params.input, "What is 2+2?");
      return { output_text: "4" };
    },
  },
};

const classifyClient = {
  responses: {
    async parse(params) {
      assert.equal(params.model, "gpt-5.2");
      assert.ok(Array.isArray(params.input));
      assert.ok(params.text && params.text.format);
      return { output_parsed: { label: "spam" } };
    },
  },
};

const answer = await ask(askClient, "What is 2+2?");
assert.equal(answer, "4");
assert.equal(typeof answer, "string");

const result = await classify(classifyClient, "Buy cheap watches now!!!");
assert.deepEqual(result, { label: "spam" });

console.log("smoke test passed");

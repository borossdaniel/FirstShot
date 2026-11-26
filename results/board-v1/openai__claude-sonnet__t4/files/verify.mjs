import { ask, classify } from "./solution.mjs";

const mockClient = {
  responses: {
    async create(params) {
      console.log("create() called with:", JSON.stringify(params, null, 2));
      if (params.model !== "gpt-5.2") throw new Error("wrong model");
      return { output_text: "mock answer" };
    },
    async parse(params) {
      console.log("parse() called with:", JSON.stringify(params, null, 2));
      if (params.model !== "gpt-5.2") throw new Error("wrong model");
      if (params.text?.format?.type !== "json_schema") {
        throw new Error("expected json_schema text format");
      }
      return { output_parsed: { label: "spam" } };
    },
  },
};

const answer = await ask(mockClient, "What is 2+2?");
console.log("ask() returned:", answer, typeof answer);
if (typeof answer !== "string") throw new Error("ask() did not return a string");

const result = await classify(mockClient, "Buy cheap watches now!!!");
console.log("classify() returned:", result);
if (result.label !== "spam") throw new Error("classify() did not return expected label");

console.log("ALL CHECKS PASSED");

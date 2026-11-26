import { weatherAnswer } from "./solution.mjs";
import assert from "node:assert";

let call = 0;
const mockClient = {
  messages: {
    async create(params) {
      call += 1;
      assert.strictEqual(params.model, "claude-sonnet-5");
      assert.strictEqual(params.max_tokens, 1024);
      assert.strictEqual(params.tools[0].name, "get_weather");

      if (call === 1) {
        assert.strictEqual(params.messages.length, 1);
        return {
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me check." },
            {
              type: "tool_use",
              id: "toolu_1",
              name: "get_weather",
              input: { city: "Paris" },
            },
          ],
        };
      }

      if (call === 2) {
        // assistant turn + tool_result turn appended
        assert.strictEqual(params.messages.length, 3);
        const toolResultMsg = params.messages[2];
        assert.strictEqual(toolResultMsg.role, "user");
        assert.strictEqual(toolResultMsg.content[0].type, "tool_result");
        assert.strictEqual(toolResultMsg.content[0].tool_use_id, "toolu_1");
        const parsed = JSON.parse(toolResultMsg.content[0].content);
        assert.deepStrictEqual(parsed, { city: "Paris", temp_c: 21 });

        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "It's 21°C in Paris." }],
        };
      }

      throw new Error("unexpected extra call");
    },
  },
};

const answer = await weatherAnswer(mockClient, "What's the weather in Paris?");
assert.strictEqual(answer, "It's 21°C in Paris.");
assert.strictEqual(call, 2);
console.log("mock test passed:", answer);

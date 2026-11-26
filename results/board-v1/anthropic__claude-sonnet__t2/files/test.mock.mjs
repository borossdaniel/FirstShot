import assert from "node:assert";
import { weatherAnswer } from "./solution.mjs";

let callCount = 0;

const mockClient = {
  messages: {
    async create(params) {
      callCount += 1;

      assert.strictEqual(params.model, "claude-sonnet-5-5");
      assert.strictEqual(params.max_tokens, 1024);
      assert.strictEqual(params.tools.length, 1);
      assert.strictEqual(params.tools[0].name, "get_weather");

      if (callCount === 1) {
        assert.deepStrictEqual(params.messages, [
          { role: "user", content: "What's the weather in Paris?" },
        ]);
        return {
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me check." },
            {
              type: "tool_use",
              id: "toolu_123",
              name: "get_weather",
              input: { city: "Paris" },
            },
          ],
        };
      }

      if (callCount === 2) {
        assert.strictEqual(params.messages.length, 3);
        assert.strictEqual(params.messages[1].role, "assistant");
        const toolResultMsg = params.messages[2];
        assert.strictEqual(toolResultMsg.role, "user");
        assert.strictEqual(toolResultMsg.content[0].type, "tool_result");
        assert.strictEqual(toolResultMsg.content[0].tool_use_id, "toolu_123");
        assert.deepStrictEqual(
          JSON.parse(toolResultMsg.content[0].content),
          { city: "Paris", temp_c: 21 }
        );

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
assert.strictEqual(callCount, 2);
console.log("OK:", answer);

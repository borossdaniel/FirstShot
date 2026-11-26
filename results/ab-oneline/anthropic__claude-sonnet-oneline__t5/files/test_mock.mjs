import assert from "node:assert";
import { weatherAnswer } from "./solution.mjs";

let call = 0;
const mockClient = {
  messages: {
    async create(params) {
      call++;
      assert.strictEqual(params.model, "claude-sonnet-5-5");
      assert.strictEqual(params.max_tokens, 1024);
      assert.strictEqual(params.tools[0].name, "get_weather");

      if (call === 1) {
        assert.deepStrictEqual(params.messages, [
          { role: "user", content: "What's the weather in Paris?" },
        ]);
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
        const last = params.messages[params.messages.length - 1];
        assert.strictEqual(last.role, "user");
        assert.strictEqual(last.content[0].type, "tool_result");
        assert.strictEqual(last.content[0].tool_use_id, "toolu_1");
        assert.strictEqual(
          last.content[0].content,
          JSON.stringify({ city: "Paris", temp_c: 21 })
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
assert.strictEqual(call, 2);
console.log("OK - mock multi-turn tool-use loop works. Answer:", answer);

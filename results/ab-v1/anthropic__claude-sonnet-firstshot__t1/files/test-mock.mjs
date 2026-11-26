import assert from "node:assert/strict";
import { weatherAnswer } from "./solution.mjs";

let call = 0;

const mockClient = {
  messages: {
    async create(params) {
      call += 1;
      assert.equal(params.model, "claude-sonnet-5-5");
      assert.equal(params.max_tokens, 1024);
      assert.equal(params.tools.length, 1);
      assert.equal(params.tools[0].name, "get_weather");

      if (call === 1) {
        assert.equal(params.messages.length, 1);
        assert.equal(params.messages[0].role, "user");
        assert.equal(params.messages[0].content, "What's the weather in Paris?");
        return {
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me check." },
            {
              type: "tool_use",
              id: "tool_123",
              name: "get_weather",
              input: { city: "Paris" },
            },
          ],
        };
      }

      if (call === 2) {
        assert.equal(params.messages.length, 3);
        const toolResultMsg = params.messages[2];
        assert.equal(toolResultMsg.role, "user");
        assert.equal(toolResultMsg.content.length, 1);
        assert.equal(toolResultMsg.content[0].type, "tool_result");
        assert.equal(toolResultMsg.content[0].tool_use_id, "tool_123");
        assert.equal(
          toolResultMsg.content[0].content,
          JSON.stringify({ city: "Paris", temp_c: 21 }),
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
assert.equal(answer, "It's 21°C in Paris.");
assert.equal(call, 2);
console.log("OK:", answer);

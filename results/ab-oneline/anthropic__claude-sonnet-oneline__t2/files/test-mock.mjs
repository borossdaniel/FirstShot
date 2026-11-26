import { weatherAnswer } from "./solution.mjs";

let call = 0;

const mockClient = {
  messages: {
    async create(params) {
      call += 1;

      if (call === 1) {
        if (params.model !== "claude-sonnet-5-5") {
          throw new Error(`unexpected model: ${params.model}`);
        }
        if (params.max_tokens !== 1024) {
          throw new Error(`unexpected max_tokens: ${params.max_tokens}`);
        }
        if (!params.tools || params.tools[0].name !== "get_weather") {
          throw new Error("missing get_weather tool");
        }
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

      if (call === 2) {
        const lastMsg = params.messages[params.messages.length - 1];
        if (lastMsg.role !== "user") {
          throw new Error("expected tool_result in a user message");
        }
        const toolResult = lastMsg.content[0];
        if (toolResult.type !== "tool_result" || toolResult.tool_use_id !== "toolu_123") {
          throw new Error("tool_result malformed");
        }
        const parsed = JSON.parse(toolResult.content);
        if (parsed.city !== "Paris" || parsed.temp_c !== 21) {
          throw new Error("tool_result content incorrect");
        }
        return {
          stop_reason: "end_turn",
          content: [{ type: "text", text: "It's 21°C in Paris." }],
        };
      }

      throw new Error("too many calls");
    },
  },
};

const answer = await weatherAnswer(mockClient, "What's the weather in Paris?");

if (answer !== "It's 21°C in Paris.") {
  throw new Error(`unexpected final answer: ${answer}`);
}

if (call !== 2) {
  throw new Error(`expected exactly 2 API calls, got ${call}`);
}

console.log("PASS:", answer);

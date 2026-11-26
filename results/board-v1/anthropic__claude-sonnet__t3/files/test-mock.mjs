import { weatherAnswer } from "./solution.mjs";

let call = 0;
const mockClient = {
  messages: {
    async create(params) {
      call++;
      if (call === 1) {
        if (params.model !== "claude-sonnet-5-5") throw new Error("wrong model");
        if (params.max_tokens !== 1024) throw new Error("wrong max_tokens");
        if (!params.tools?.some((t) => t.name === "get_weather")) throw new Error("missing tool");
        return {
          stop_reason: "tool_use",
          content: [
            { type: "text", text: "Let me check." },
            { type: "tool_use", id: "toolu_1", name: "get_weather", input: { city: "Paris" } },
          ],
        };
      }
      if (call === 2) {
        const last = params.messages[params.messages.length - 1];
        const toolResultBlock = last.content[0];
        if (toolResultBlock.type !== "tool_result") throw new Error("expected tool_result");
        if (toolResultBlock.tool_use_id !== "toolu_1") throw new Error("wrong tool_use_id");
        const parsed = JSON.parse(toolResultBlock.content);
        if (parsed.city !== "Paris" || parsed.temp_c !== 21) throw new Error("wrong tool output");
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
if (answer !== "It's 21°C in Paris.") {
  throw new Error("unexpected final answer: " + answer);
}
if (call !== 2) {
  throw new Error("expected exactly 2 calls, got " + call);
}
console.log("OK:", answer);

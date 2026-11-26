import { MockLanguageModelV4 } from "ai/test";
import { answerWithWeather, extractContact } from "./solution.mjs";

async function testWeather() {
  let call = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      call += 1;
      if (call === 1) {
        return {
          finishReason: { unified: "tool-calls", raw: undefined },
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          content: [
            {
              type: "tool-call",
              toolCallId: "call-1",
              toolName: "getWeather",
              input: JSON.stringify({ city: "Paris" }),
            },
          ],
          warnings: [],
        };
      }
      return {
        finishReason: { unified: "stop", raw: undefined },
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        content: [
          { type: "text", text: "It is 21C in Paris." },
        ],
        warnings: [],
      };
    },
  });

  const answer = await answerWithWeather(model, "What's the weather in Paris?");
  console.log("answerWithWeather -> call count:", call, "answer:", JSON.stringify(answer));
}

async function testExtract() {
  const model = new MockLanguageModelV4({
    doGenerate: async () => ({
      finishReason: { unified: "stop", raw: undefined },
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
      content: [
        {
          type: "text",
          text: JSON.stringify({ name: "Jane Doe", email: "jane@example.com" }),
        },
      ],
      warnings: [],
    }),
  });

  const contact = await extractContact(
    model,
    "Hi, this is Jane Doe, you can reach me at jane@example.com."
  );
  console.log("extractContact ->", contact);
}

await testWeather();
await testExtract();

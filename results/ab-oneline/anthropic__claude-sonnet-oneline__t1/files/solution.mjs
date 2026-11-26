const MODEL = "claude-sonnet-5-5";
const MAX_TOKENS = 1024;

const WEATHER_TOOL = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  input_schema: {
    type: "object",
    properties: {
      city: { type: "string" },
    },
    required: ["city"],
  },
};

function runTool(name, input) {
  if (name === "get_weather") {
    return { city: input.city, temp_c: 21 };
  }
  throw new Error(`Unknown tool: ${name}`);
}

export async function weatherAnswer(client, question) {
  const messages = [{ role: "user", content: question }];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      tools: [WEATHER_TOOL],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    const toolResults = response.content
      .filter((block) => block.type === "tool_use")
      .map((block) => ({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(runTool(block.name, block.input)),
      }));

    messages.push({ role: "user", content: toolResults });
  }
}

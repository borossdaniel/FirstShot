const MODEL = "claude-sonnet-5";

const WEATHER_TOOL = {
  name: "get_weather",
  description: "Get the current weather for a city.",
  input_schema: {
    type: "object",
    properties: {
      city: { type: "string", description: "The city to get the weather for." },
    },
    required: ["city"],
  },
};

function runWeatherTool(input) {
  return { city: input.city, temp_c: 21 };
}

export async function weatherAnswer(client, question) {
  const messages = [{ role: "user", content: question }];

  while (true) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 1024,
      tools: [WEATHER_TOOL],
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults = response.content
      .filter((block) => block.type === "tool_use")
      .map((block) => ({
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(runWeatherTool(block.input)),
      }));

    messages.push({ role: "user", content: toolResults });
  }
}

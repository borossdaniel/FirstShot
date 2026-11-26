const MODEL = "claude-sonnet-5-5";

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

function getWeather({ city }) {
  return { city, temp_c: 21 };
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

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    const toolUseBlocks = response.content.filter((block) => block.type === "tool_use");
    const toolResults = toolUseBlocks.map((block) => {
      const result = getWeather(block.input);
      return {
        type: "tool_result",
        tool_use_id: block.id,
        content: JSON.stringify(result),
      };
    });

    messages.push({ role: "user", content: toolResults });
  }
}

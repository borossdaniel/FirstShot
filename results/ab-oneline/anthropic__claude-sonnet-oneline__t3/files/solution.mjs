const GET_WEATHER_TOOL = {
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
      model: "claude-sonnet-5-5",
      max_tokens: 1024,
      tools: [GET_WEATHER_TOOL],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });

    if (response.stop_reason !== "tool_use") {
      return response.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("");
    }

    const toolResults = [];
    for (const block of response.content) {
      if (block.type === "tool_use" && block.name === "get_weather") {
        const result = getWeather(block.input);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages.push({ role: "user", content: toolResults });
  }
}

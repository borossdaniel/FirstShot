const tools = [{ name: 'get_weather', description: 'weather', input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] } }];
export async function weatherAnswer(client, question) {
  const messages = [{ role: 'user', content: question }];
  let res = await client.messages.create({ model: 'claude-sonnet-5-5', max_tokens: 1024, tools, messages });
  const use = res.content.find((c) => c.type === 'tool_use');
  if (use) {
    messages.push({ role: 'assistant', content: res.content });
    messages.push({ role: 'user', content: `Tool result: ${JSON.stringify({ city: use.input.city, temp_c: 21 })}` });
    res = await client.messages.create({ model: 'claude-sonnet-5-5', max_tokens: 1024, tools, messages });
  }
  return res.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
}

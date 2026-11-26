const tools = [{
  name: 'get_weather',
  description: 'Get the current weather for a city',
  input_schema: { type: 'object', properties: { city: { type: 'string' } }, required: ['city'] },
}];

export async function weatherAnswer(client, question) {
  const messages = [{ role: 'user', content: question }];
  for (let i = 0; i < 10; i++) {
    const res = await client.messages.create({ model: 'claude-sonnet-5-5', max_tokens: 1024, tools, messages });
    if (res.stop_reason !== 'tool_use') {
      return res.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
    }
    messages.push({ role: 'assistant', content: res.content });
    const results = res.content
      .filter((c) => c.type === 'tool_use')
      .map((c) => ({ type: 'tool_result', tool_use_id: c.id, content: JSON.stringify({ city: c.input.city, temp_c: 21 }) }));
    messages.push({ role: 'user', content: results });
  }
  throw new Error('too many tool rounds');
}

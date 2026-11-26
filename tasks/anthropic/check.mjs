import { runCheck, expectInstalled, importSolution, importFromWorkspace, startMockServer, expect, expectEqual } from '../../src/check-helpers.js';

const msg = (content, stop_reason) => ({
  id: 'msg_' + Math.random().toString(36).slice(2), type: 'message', role: 'assistant', model: 'claude-sonnet-5-5',
  content, stop_reason, stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
});

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@anthropic-ai/sdk', 1);
  const sdk = await importFromWorkspace(ws, '@anthropic-ai/sdk');
  const Anthropic = sdk.default ?? sdk.Anthropic;
  const m = await importSolution(ws);
  expect(typeof m.weatherAnswer === 'function', 'weatherAnswer is not exported');

  let sawToolResult = null;
  const mock = await startMockServer((req, n) => {
    if (!req.path.startsWith('/v1/messages')) return { status: 404, json: { type: 'error', error: { type: 'not_found_error', message: req.path } } };
    const b = req.body;
    if (n === 1) {
      const tool = (b.tools || []).find((t) => t.name === 'get_weather');
      if (!tool) return { json: msg([{ type: 'text', text: 'NO_TOOL_GIVEN' }], 'end_turn') };
      return { json: msg([{ type: 'text', text: 'Let me check.' }, { type: 'tool_use', id: 'toolu_01', name: 'get_weather', input: { city: 'Amsterdam' } }], 'tool_use') };
    }
    const last = b.messages?.[b.messages.length - 1];
    const blocks = Array.isArray(last?.content) ? last.content : [];
    sawToolResult = blocks.find((c) => c.type === 'tool_result' && c.tool_use_id === 'toolu_01') || null;
    const asst = b.messages?.[b.messages.length - 2];
    const keptToolUse = Array.isArray(asst?.content) && asst.content.some((c) => c.type === 'tool_use' && c.id === 'toolu_01');
    if (!sawToolResult || !keptToolUse || last.role !== 'user') return { json: msg([{ type: 'text', text: 'BAD_TOOL_RESULT_FORMAT' }], 'end_turn') };
    return { json: msg([{ type: 'text', text: 'It is 21°C in Amsterdam.' }], 'end_turn') };
  });
  try {
    const client = new Anthropic({ apiKey: 'sk-ant-test', baseURL: mock.url, maxRetries: 0 });
    const answer = await m.weatherAnswer(client, 'Weather in Amsterdam?');
    const first = mock.requests[0];
    expect(first, 'no request was sent');
    expectEqual(first.body.model, 'claude-sonnet-5-5', 'model');
    expectEqual(first.body.max_tokens, 1024, 'max_tokens');
    const tool = (first.body.tools || []).find((t) => t.name === 'get_weather');
    expect(tool, 'tool get_weather was not sent');
    expect(JSON.stringify(tool.input_schema || {}).includes('city'), 'get_weather input_schema should have a city field');
    expect(mock.requests.length >= 2, 'after the tool_use the result must be sent back to Claude (only one request was made)');
    expect(sawToolResult, 'the tool result was not sent back as a tool_result block that references the tool_use id, after the assistant turn');
    expect(JSON.stringify(sawToolResult.content).includes('21'), 'the tool_result content should contain the tool output (temp_c: 21)');
    expectEqual(answer, 'It is 21°C in Amsterdam.', 'final answer');
  } finally {
    await mock.close();
  }
  return `@anthropic-ai/sdk@${version}: tool loop and final answer correct`;
});

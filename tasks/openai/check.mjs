import { runCheck, expectInstalled, importSolution, importFromWorkspace, startMockServer, expect, expectEqual } from '../../src/check-helpers.js';

function response(text) {
  return {
    id: 'resp_1', object: 'response', created_at: 1, status: 'completed', model: 'gpt-5.2',
    output: [{ id: 'msg_1', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text, annotations: [] }] }],
    usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 },
  };
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, 'openai', 7);
  const { default: OpenAI } = await importFromWorkspace(ws, 'openai');
  const m = await importSolution(ws);
  expect(typeof m.ask === 'function' && typeof m.classify === 'function', 'ask and classify must both be exported');

  const mock = await startMockServer((req) => {
    if (req.path.endsWith('/responses')) {
      const wantsJson = req.body?.text?.format?.type === 'json_schema';
      return { json: response(wantsJson ? JSON.stringify({ label: 'spam' }) : 'Paris.') };
    }
    if (req.path.endsWith('/chat/completions')) {
      // Answer properly so the code runs; the check then reports the wrong API clearly.
      return { json: { id: 'cc_1', object: 'chat.completion', created: 1, model: 'gpt-5.2', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'Paris.' } }] } };
    }
    return { status: 404, json: { error: { message: `unexpected endpoint ${req.path}` } } };
  });
  try {
    const client = new OpenAI({ apiKey: 'sk-test', baseURL: mock.url + '/v1', maxRetries: 0 });
    const answer = await m.ask(client, 'Capital of France?');
    const first = mock.requests[0];
    expect(first, 'ask() made no request');
    expect(first.path.endsWith('/responses'), `ask() should use the Responses API, but called ${first.path}`);
    expectEqual(first.body.model, 'gpt-5.2', 'model sent by ask()');
    expectEqual(answer, 'Paris.', 'ask() return value');

    const before = mock.requests.length;
    const label = await m.classify(client, 'WIN A FREE CRUISE!!!');
    const req = mock.requests[before];
    expect(req && req.path.endsWith('/responses'), `classify() should use the Responses API, but called ${req?.path}`);
    const fmt = req.body?.text?.format;
    expect(fmt?.type === 'json_schema', `classify() must request structured output (text.format json_schema); sent ${JSON.stringify(fmt)}`);
    const enumVals = JSON.stringify(fmt.schema || {});
    expect(enumVals.includes('spam') && enumVals.includes('ham'), 'the JSON schema should restrict label to "spam" | "ham"');
    expectEqual(label, { label: 'spam' }, 'classify() return value');
  } finally {
    await mock.close();
  }
  return `openai@${version}: Responses API text and structured output correct`;
});

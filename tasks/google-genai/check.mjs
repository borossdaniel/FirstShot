import { runCheck, expectInstalled, importSolution, importFromWorkspace, startMockServer, expect, expectEqual, fail, firstLine } from '../../src/check-helpers.js';

const MODEL = 'gemini-2.5-flash';

function reply(text) {
  return {
    candidates: [{ content: { role: 'model', parts: [{ text }] }, finishReason: 'STOP', index: 0 }],
    usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 5, totalTokenCount: 10 },
    modelVersion: MODEL,
  };
}

runCheck(async (ws) => {
  const version = expectInstalled(ws, '@google/genai', 3);
  const { GoogleGenAI } = await importFromWorkspace(ws, '@google/genai');
  expect(typeof GoogleGenAI === 'function', '@google/genai does not export GoogleGenAI');
  const m = await importSolution(ws);
  expect(typeof m.ask === 'function' && typeof m.extractContact === 'function', 'ask and extractContact must both be exported');

  const mock = await startMockServer((req) => {
    if (req.method === 'POST' && /\/models\/[^/:]+:generateContent/.test(req.path)) {
      const cfg = req.body?.generationConfig || {};
      const wantsJson = cfg.responseMimeType === 'application/json';
      return { json: reply(wantsJson ? JSON.stringify({ name: 'Ada Lovelace', email: 'ada@example.com' }) : 'Paris is the capital of France.') };
    }
    return { status: 404, json: { error: { code: 404, message: `not mocked: ${req.method} ${req.path}`, status: 'NOT_FOUND' } } };
  });
  const describe = () => mock.requests.map((r) => `${r.method} ${r.path}`).join(', ') || 'none';
  try {
    const ai = new GoogleGenAI({ apiKey: 'test-key', httpOptions: { baseUrl: mock.url } });

    const answer = await m.ask(ai, 'What is the capital of France?');
    const first = mock.requests[0];
    expect(first, 'ask() made no request');
    expect(first.path.includes(`/models/${MODEL}:generateContent`), `ask() should call generateContent on ${MODEL}, but called ${first.method} ${first.path}`);
    expect(JSON.stringify(first.body?.contents ?? '').includes('What is the capital of France?'), `ask() did not send the question in contents: ${JSON.stringify(first.body).slice(0, 200)}`);
    expectEqual(answer, 'Paris is the capital of France.', 'ask() return value');

    const before = mock.requests.length;
    let contact;
    let err;
    try {
      contact = await m.extractContact(ai, 'Hi, this is Ada Lovelace - reach me at ada@example.com any time.');
    } catch (e) {
      err = e;
    }
    const req = mock.requests[before];
    expect(req, `extractContact() made no request (requests: ${describe()})`);
    expect(req.path.includes(`/models/${MODEL}:generateContent`), `extractContact() should call generateContent on ${MODEL}, but called ${req.method} ${req.path}`);
    expect(JSON.stringify(req.body?.contents ?? '').includes('ada@example.com'), 'extractContact() did not send the input text to the model');
    const cfg = req.body?.generationConfig || {};
    expect(cfg.responseMimeType === 'application/json', `extractContact() must request structured output (responseMimeType "application/json"); sent generationConfig ${JSON.stringify(cfg).slice(0, 200)}`);
    const schema = cfg.responseSchema ?? cfg.responseJsonSchema;
    expect(schema, 'extractContact() set a JSON response type but no response schema (responseSchema / responseJsonSchema)');
    const props = schema.properties || {};
    expect(props.name && props.email, `the response schema should have properties name and email, got ${JSON.stringify(schema).slice(0, 200)}`);
    if (err) fail('crash', `extractContact() threw: ${firstLine(err)}`);
    expectEqual(contact, { name: 'Ada Lovelace', email: 'ada@example.com' }, 'extractContact() return value');
  } finally {
    await mock.close();
  }
  return `@google/genai@${version}: text and schema-constrained JSON output correct`;
});

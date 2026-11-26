import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCheck, fail, expect, startMockServer, firstLine } from '../../src/check-helpers.js';

const FACTS = JSON.parse(readFileSync(new URL('../../data/live-facts.json', import.meta.url), 'utf8'));
const NEWEST = FACTS.openaiNewestPrefix;

runCheck(async (ws) => {
  const file = join(ws, 'ai.mjs');
  if (!existsSync(file)) fail('no_solution', 'ai.mjs was not created');
  if (!existsSync(join(ws, 'node_modules/openai'))) fail('not_installed', 'openai is not installed');
  let model = null;
  const mock = await startMockServer((req) => {
    model = req.body?.model ?? model;
    if (req.path.endsWith('/responses')) {
      return { json: { id: 'resp_1', object: 'response', created_at: 1, status: 'completed', model: model || 'x', output: [{ id: 'm1', type: 'message', role: 'assistant', status: 'completed', content: [{ type: 'output_text', text: 'A short summary.', annotations: [] }] }], usage: { input_tokens: 1, output_tokens: 1, total_tokens: 2 } } };
    }
    if (req.path.endsWith('/chat/completions')) {
      return { json: { id: 'c1', object: 'chat.completion', created: 1, model: model || 'x', choices: [{ index: 0, finish_reason: 'stop', message: { role: 'assistant', content: 'A short summary.' } }] } };
    }
    return { status: 404, json: {} };
  });
  process.env.OPENAI_BASE_URL = mock.url + '/v1';
  process.env.OPENAI_API_KEY = 'sk-test';
  try {
    const m = await import(pathToFileURL(file).href);
    expect(typeof m.summarize === 'function', 'summarize is not exported');
    const out = await m.summarize('OneShot checks which model your agent picks.');
    expect(typeof out === 'string' && out.length > 0, 'summarize did not return text');
  } catch (err) {
    if (err?.category) throw err;
    const src = readFileSync(file, 'utf8');
    model = model || ((src.match(/['"`]((?:gpt|o\d)[a-z0-9.:-]*)['"`]/) || [])[1] ?? null);
    if (!model) fail('crash', `ai.mjs could not run and names no OpenAI model: ${firstLine(err)}`);
  } finally {
    await mock.close();
  }
  if (!model) fail('wrong_behavior', 'no OpenAI model was requested');
  if (!String(model).startsWith(NEWEST)) fail('outdated_fact', `asked for "${model}"; the newest generation is ${NEWEST}`);
  return `uses ${model}`;
});
